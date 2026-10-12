/**
 * Admin-side Kavita API calls used only to seed and mutate the live test
 * server. The plugin itself never calls these endpoints.
 *
 * @module
 */
import { Effect, flow, Schedule, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

/**
 * A logged-in Kavita user.
 *
 * @since 2.0.0
 * @category Kavita Admin
 */
export const Session = Schema.Struct({
	id: Schema.Int,
	token: Schema.String,
	apiKey: Schema.optionalKey(Schema.NullOr(Schema.String)),
});

/**
 * @since 2.0.0
 * @category Kavita Admin
 */
export type Session = typeof Session.Type;

const Library = Schema.Struct({ id: Schema.Int, name: Schema.String });
const Series = Schema.Struct({
	id: Schema.Int,
	name: Schema.String,
	libraryId: Schema.Int,
});
const SeriesVolume = Schema.Struct({
	id: Schema.Int,
	number: Schema.Finite,
	chapters: Schema.Array(Schema.Struct({ id: Schema.Int })),
});
const AuthKey = Schema.Struct({ key: Schema.String });
const Invite = Schema.Struct({ emailLink: Schema.String });
const CreatedAnnotation = Schema.Struct({ id: Schema.Int });
const RawAnnotation = Schema.Struct({
	id: Schema.Int,
	ownerUserId: Schema.Int,
	selectedText: Schema.NullOr(Schema.String),
});
const Preferences = Schema.Record(Schema.String, Schema.Unknown);

/**
 * Body for `POST /api/Annotation/create`.
 *
 * @since 2.0.0
 * @category Kavita Admin
 */
export const NewAnnotation = Schema.Struct({
	chapterId: Schema.Int,
	volumeId: Schema.Int,
	seriesId: Schema.Int,
	libraryId: Schema.Int,
	pageNumber: Schema.Int,
	selectedText: Schema.String,
	comment: Schema.NullOr(Schema.String),
	containsSpoiler: Schema.Boolean,
	selectedSlotIndex: Schema.Int,
});

/**
 * @since 2.0.0
 * @category Kavita Admin
 */
export type NewAnnotation = typeof NewAnnotation.Type;

const json =
	<S extends Schema.Decoder<unknown>>(schema: S) =>
	(response: HttpClientResponse.HttpClientResponse) =>
		HttpClientResponse.schemaBodyJson(schema)(response);

/**
 * Admin client bound to one Kavita base URL.
 *
 * @since 2.0.0
 * @category Kavita Admin
 */
export const makeKavitaAdmin = Effect.fnUntraced(function* (baseUrl: string) {
	const http = (yield* HttpClient.HttpClient).pipe(
		HttpClient.mapRequest(
			flow(HttpClientRequest.prependUrl(baseUrl), HttpClientRequest.acceptJson),
		),
		HttpClient.filterStatusOk,
	);

	const as = (session: Session) =>
		http.pipe(
			HttpClient.mapRequest(HttpClientRequest.bearerToken(session.token)),
		);

	const waitUntilHealthy = http
		.get("/api/health")
		.pipe(
			Effect.retry({ schedule: Schedule.spaced("2 seconds"), times: 90 }),
			Effect.asVoid,
		);

	const login = (username: string, password: string) =>
		http
			.execute(
				HttpClientRequest.post("/api/Account/login").pipe(
					HttpClientRequest.bodyJsonUnsafe({ username, password }),
				),
			)
			.pipe(Effect.flatMap(json(Session)));

	const registerAdmin = (username: string, password: string) =>
		http
			.execute(
				HttpClientRequest.post("/api/Account/register").pipe(
					HttpClientRequest.bodyJsonUnsafe({
						username,
						password,
						email: `${username}@test.local`,
					}),
				),
			)
			.pipe(Effect.asVoid);

	const createAuthKey = (session: Session, name: string) =>
		as(session)
			.execute(
				HttpClientRequest.post("/api/Account/create-auth-key").pipe(
					HttpClientRequest.bodyJsonUnsafe({ keyLength: 32, name }),
				),
			)
			.pipe(
				Effect.flatMap(json(AuthKey)),
				Effect.map((k) => k.key),
			);

	const libraries = (session: Session) =>
		as(session)
			.get("/api/Library/libraries")
			.pipe(Effect.flatMap(json(Schema.Array(Library))));

	const createBookLibrary = (session: Session, folder: string) =>
		as(session)
			.execute(
				HttpClientRequest.post("/api/Library/create").pipe(
					HttpClientRequest.bodyJsonUnsafe({
						id: 0,
						name: "Books",
						type: 2,
						folders: [folder],
						folderWatching: false,
						includeInDashboard: true,
						includeInSearch: true,
						manageCollections: false,
						manageReadingLists: false,
						allowScrobbling: false,
						allowMetadataMatching: false,
						enableMetadata: true,
						removePrefixForSortName: false,
						inheritWebLinksFromFirstChapter: false,
						metadataProvider: 2,
						fileGroupTypes: [2],
						excludePatterns: [],
					}),
				),
			)
			.pipe(Effect.asVoid);

	const scanLibrary = (session: Session, libraryId: number) =>
		as(session)
			.execute(
				HttpClientRequest.post("/api/Library/scan").pipe(
					HttpClientRequest.setUrlParams({
						libraryId: String(libraryId),
						force: "true",
					}),
				),
			)
			.pipe(Effect.asVoid);

	const series = (session: Session) =>
		as(session)
			.execute(
				HttpClientRequest.post("/api/Series/all-v2").pipe(
					HttpClientRequest.bodyJsonUnsafe({}),
				),
			)
			.pipe(Effect.flatMap(json(Schema.Array(Series))));

	const volumes = (session: Session, seriesId: number) =>
		as(session)
			.get("/api/Series/volumes", {
				urlParams: { seriesId: String(seriesId) },
			})
			.pipe(Effect.flatMap(json(Schema.Array(SeriesVolume))));

	const allVisibleAnnotations = (session: Session) =>
		as(session)
			.execute(
				HttpClientRequest.post("/api/Annotation/all-filtered").pipe(
					HttpClientRequest.bodyJsonUnsafe({}),
				),
			)
			.pipe(Effect.flatMap(json(Schema.Array(RawAnnotation))));

	const createAnnotation = (session: Session, annotation: NewAnnotation) =>
		as(session)
			.execute(
				HttpClientRequest.post("/api/Annotation/create").pipe(
					HttpClientRequest.bodyJsonUnsafe({
						...annotation,
						ownerUserId: session.id,
						xPath: "//html[1]/BODY/APP-ROOT[1]/DIV[1]/P[1]",
						highlightCount: annotation.selectedText.length,
					}),
				),
			)
			.pipe(
				Effect.flatMap(json(CreatedAnnotation)),
				Effect.map((created) => created.id),
			);

	const deleteAnnotation = (session: Session, annotationId: number) =>
		as(session)
			.execute(
				HttpClientRequest.delete("/api/Annotation").pipe(
					HttpClientRequest.setUrlParams({
						annotationId: String(annotationId),
					}),
				),
			)
			.pipe(Effect.asVoid);

	const inviteUser = (
		session: Session,
		email: string,
		libraryIds: ReadonlyArray<number>,
	) =>
		as(session)
			.execute(
				HttpClientRequest.post("/api/Account/invite").pipe(
					HttpClientRequest.bodyJsonUnsafe({
						email,
						roles: ["Login"],
						libraries: libraryIds,
						ageRestriction: { ageRating: -1, includeUnknowns: true },
					}),
				),
			)
			.pipe(
				Effect.flatMap(json(Invite)),
				Effect.map(
					(invite) => new URL(invite.emailLink).searchParams.get("token") ?? "",
				),
			);

	const confirmUser = (
		email: string,
		token: string,
		username: string,
		password: string,
	) =>
		http
			.execute(
				HttpClientRequest.post("/api/Account/confirm-email").pipe(
					HttpClientRequest.bodyJsonUnsafe({
						email,
						token,
						username,
						password,
					}),
				),
			)
			.pipe(Effect.flatMap(json(Session)));

	const enableSocial = (
		session: Session,
		preference: "shareAnnotations" | "viewOtherAnnotations",
	) =>
		Effect.gen(function* () {
			const prefs = yield* as(session)
				.get("/api/Users/get-preferences")
				.pipe(Effect.flatMap(json(Preferences)));
			const social = yield* Schema.decodeUnknownEffect(Preferences)(
				prefs.socialPreferences,
			);
			yield* as(session).execute(
				HttpClientRequest.post("/api/Users/update-preferences").pipe(
					HttpClientRequest.bodyJsonUnsafe({
						...prefs,
						socialPreferences: { ...social, [preference]: true },
					}),
				),
			);
		});

	return {
		waitUntilHealthy,
		login,
		registerAdmin,
		createAuthKey,
		libraries,
		createBookLibrary,
		scanLibrary,
		series,
		volumes,
		allVisibleAnnotations,
		createAnnotation,
		deleteAnnotation,
		inviteUser,
		confirmUser,
		enableSocial,
	};
});

/**
 * @since 2.0.0
 * @category Kavita Admin
 */
export type KavitaAdmin = Effect.Success<ReturnType<typeof makeKavitaAdmin>>;
