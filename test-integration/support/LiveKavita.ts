/**
 * A seeded, live Kavita server for integration tests.
 *
 * Building the layer waits for the server, bootstraps an admin and a second
 * "reader" user who shares annotations, creates the fixture library, and
 * resets every annotation to the fixture set, so it is safe to re-run against
 * the same container.
 *
 * @module
 */
import { Context, Effect, Layer, Schedule } from "effect";
import { FetchHttpClient } from "effect/http";
import { FIXTURE_LIBRARY, type FixtureBook } from "../fixtures/library.js";
import {
	type KavitaAdmin,
	makeKavitaAdmin,
	type NewAnnotation,
	type Session,
} from "./KavitaAdmin.js";

/**
 * Text of the annotation owned by the second user; it must never sync.
 *
 * @since 2.0.0
 * @category Live Kavita
 */
export const READER_ANNOTATION_TEXT =
	"Iron remembers the shape of the fire that made it.";

const ADMIN = { username: "admin", password: "Admin123!" };
const READER = {
	username: "reader",
	password: "Reader123!",
	email: "reader@test.local",
};

/**
 * Kavita IDs for one fixture book.
 *
 * @since 2.0.0
 * @category Live Kavita
 */
export interface SeededBook {
	readonly fixture: FixtureBook;
	readonly seriesId: number;
	readonly volumeId: number;
	readonly chapterId: number;
	readonly libraryId: number;
}

const annotationFor = (
	book: SeededBook,
	text: string,
	overrides: Partial<NewAnnotation> = {},
): NewAnnotation => ({
	chapterId: book.chapterId,
	volumeId: book.volumeId,
	seriesId: book.seriesId,
	libraryId: book.libraryId,
	pageNumber: 1,
	selectedText: text,
	comment: null,
	containsSpoiler: false,
	selectedSlotIndex: 2,
	...overrides,
});

/**
 * The live server and handles for mutating it.
 *
 * @since 2.0.0
 * @category Live Kavita
 */
export class LiveKavita extends Context.Service<
	LiveKavita,
	{
		readonly url: string;
		readonly authKey: string;
		readonly admin: Session;
		readonly reader: Session;
		readonly api: KavitaAdmin;
		readonly books: ReadonlyArray<SeededBook>;
		readonly annotationFor: (
			book: SeededBook,
			text: string,
			overrides?: Partial<NewAnnotation>,
		) => NewAnnotation;
	}
>()("test-integration/LiveKavita") {
	static readonly layer = Layer.effect(
		LiveKavita,
		Effect.gen(function* () {
			const url = process.env.KAVITA_URL ?? "http://localhost:5055";
			const api = yield* makeKavitaAdmin(url);
			yield* Effect.logInfo(`Waiting for Kavita at ${url}`);
			yield* api.waitUntilHealthy;

			const admin = yield* api
				.login(ADMIN.username, ADMIN.password)
				.pipe(
					Effect.catch(() =>
						api
							.registerAdmin(ADMIN.username, ADMIN.password)
							.pipe(Effect.andThen(api.login(ADMIN.username, ADMIN.password))),
					),
				);

			if ((yield* api.libraries(admin)).length === 0) {
				yield* api.createBookLibrary(admin, "/books");
			}
			const library = (yield* api.libraries(admin))[0];
			if (library === undefined) {
				return yield* Effect.die("Library creation failed");
			}
			const libraryId = library.id;

			const expectedSeries = new Set(FIXTURE_LIBRARY.map((b) => b.book.series));
			const series = yield* api.series(admin).pipe(
				Effect.flatMap((found) =>
					found.length >= expectedSeries.size
						? Effect.succeed(found)
						: api
								.scanLibrary(admin, libraryId)
								.pipe(
									Effect.andThen(Effect.fail(`scanned ${found.length} series`)),
								),
				),
				Effect.retry({ schedule: Schedule.spaced("2 seconds"), times: 60 }),
			);

			const books = yield* Effect.forEach(FIXTURE_LIBRARY, (fixture) =>
				Effect.gen(function* () {
					const match = series.find((s) => s.name === fixture.book.series);
					if (match === undefined) {
						return yield* Effect.die(
							`Series "${fixture.book.series}" was not scanned`,
						);
					}
					const volume = (yield* api.volumes(admin, match.id)).find(
						(v) => v.number === fixture.book.seriesIndex,
					);
					const chapter = volume?.chapters[0];
					if (volume === undefined || chapter === undefined) {
						return yield* Effect.die(
							`No volume ${fixture.book.seriesIndex} in "${fixture.book.series}"`,
						);
					}
					return {
						fixture,
						seriesId: match.id,
						volumeId: volume.id,
						chapterId: chapter.id,
						libraryId: match.libraryId,
					};
				}),
			);

			const reader = yield* api
				.login(READER.username, READER.password)
				.pipe(
					Effect.catch(() =>
						api
							.inviteUser(admin, READER.email, [libraryId])
							.pipe(
								Effect.flatMap((token) =>
									api.confirmUser(
										READER.email,
										token,
										READER.username,
										READER.password,
									),
								),
							),
					),
				);
			yield* api.enableSocial(reader, "shareAnnotations");
			yield* api.enableSocial(admin, "viewOtherAnnotations");

			for (const session of [admin, reader]) {
				const own = (yield* api.allVisibleAnnotations(session)).filter(
					(a) => a.ownerUserId === session.id,
				);
				yield* Effect.forEach(own, (a) => api.deleteAnnotation(session, a.id), {
					discard: true,
				});
			}

			for (const book of books) {
				for (const a of book.fixture.annotations) {
					yield* api.createAnnotation(
						admin,
						annotationFor(book, a.selectedText, {
							pageNumber: a.chapterIndex + 1,
							comment: a.comment,
							containsSpoiler: a.containsSpoiler,
							selectedSlotIndex: a.slot,
						}),
					);
				}
			}

			const embers = books.find((b) => b.fixture.book.title === "Embers");
			if (embers === undefined) {
				return yield* Effect.die("Embers fixture missing");
			}
			yield* api.createAnnotation(
				reader,
				annotationFor(embers, READER_ANNOTATION_TEXT, {
					pageNumber: 2,
					comment: "Owned by another user",
				}),
			);

			const authKey = yield* api
				.createAuthKey(admin, `obsidian-${Date.now()}`)
				.pipe(
					Effect.catch((error) =>
						admin.apiKey === undefined || admin.apiKey === null
							? Effect.fail(error)
							: Effect.succeed(admin.apiKey),
					),
				);
			yield* Effect.logInfo(
				`Seeded ${books.length} books on Kavita ${url} for admin #${admin.id}`,
			);

			return LiveKavita.of({
				url,
				authKey,
				admin,
				reader,
				api,
				books,
				annotationFor,
			});
		}).pipe(Effect.orDie),
	).pipe(Layer.provide(FetchHttpClient.layer));
}
