/**
 * In-memory Obsidian app for exercising the real vault adapter in tests.
 *
 * Builds real `TFile`/`TFolder` instances from the `obsidian` module (the
 * Vitest mock at runtime), so `instanceof` checks behave as in Obsidian.
 *
 * @module
 */
import { Predicate } from "effect";
import { normalizePath, parseYaml, TFile, TFolder } from "obsidian";
import type { ObsidianApp } from "../src/services/ObsidianApp.js";

/**
 * An in-memory vault plus inspection helpers.
 *
 * @since 2.0.0
 * @category Test Support
 */
export interface FakeApp {
	readonly app: ObsidianApp["Service"];
	readonly files: () => ReadonlyMap<string, string>;
	readonly binaries: () => ReadonlyMap<string, ArrayBuffer>;
	readonly folders: () => ReadonlyArray<string>;
	readonly trashed: () => ReadonlyArray<string>;
	readonly read: (path: string) => string | undefined;
	readonly seed: (path: string, content: string) => void;
	readonly move: (from: string, to: string) => void;
}

const parseFrontmatter = (
	content: string,
): Record<string, unknown> | undefined => {
	const match = /^---\n([\s\S]*?)\n---/.exec(content);
	if (match?.[1] === undefined) return undefined;
	const parsed: unknown = parseYaml(match[1]);
	return Predicate.isObject(parsed) ? { ...parsed } : undefined;
};

/**
 * Create an empty in-memory vault.
 *
 * Like Obsidian, `create` fails when the file exists or its folder is
 * missing, and `createFolder` fails when the folder exists.
 *
 * @since 2.0.0
 * @category Test Support
 */
export const makeFakeApp = (): FakeApp => {
	const root = new TFolder();
	root.path = "/";
	const index = new Map<string, TFile | TFolder>([["/", root]]);
	const contents = new Map<string, string>();
	const binaries = new Map<string, ArrayBuffer>();
	const trashed: Array<string> = [];

	const lookup = (path: string) => index.get(normalizePath(path)) ?? null;

	const parentOf = (path: string): TFolder => {
		const parentPath = path.split("/").slice(0, -1).join("/") || "/";
		const parent = index.get(parentPath);
		if (!(parent instanceof TFolder)) {
			throw new Error(`Folder does not exist: ${parentPath}`);
		}
		return parent;
	};

	const attach = (node: TFile | TFolder, path: string) => {
		const parent = parentOf(path);
		node.path = path;
		node.name = path.split("/").at(-1) ?? path;
		node.parent = parent;
		parent.children.push(node);
		index.set(path, node);
	};

	const createFolderSync = (raw: string): TFolder => {
		const path = normalizePath(raw);
		if (index.has(path)) throw new Error("Folder already exists.");
		const segments = path.split("/");
		let folder = root;
		for (let i = 1; i <= segments.length; i++) {
			const current = segments.slice(0, i).join("/");
			const existing = index.get(current);
			if (existing instanceof TFolder) {
				folder = existing;
				continue;
			}
			const created = new TFolder();
			attach(created, current);
			folder = created;
		}
		return folder;
	};

	const createSync = (raw: string, data: string): TFile => {
		const path = normalizePath(raw);
		if (index.has(path)) throw new Error("File already exists.");
		const file = new TFile();
		attach(file, path);
		file.extension = path.split(".").at(-1) ?? "";
		file.basename = file.name.replace(/\.[^.]+$/, "");
		contents.set(path, data);
		return file;
	};

	const createBinarySync = (raw: string, data: ArrayBuffer): TFile => {
		const file = createSync(raw, "");
		contents.delete(file.path);
		binaries.set(file.path, data);
		return file;
	};

	const createFolder = async (raw: string): Promise<TFolder> =>
		createFolderSync(raw);
	const create = async (raw: string, data: string): Promise<TFile> =>
		createSync(raw, data);

	const detach = (node: TFile | TFolder) => {
		const parent = node.parent;
		if (parent !== null) {
			parent.children = parent.children.filter((c) => c !== node);
		}
		index.delete(node.path);
		contents.delete(node.path);
		binaries.delete(node.path);
		if (node instanceof TFolder) {
			for (const child of node.children.slice()) {
				if (child instanceof TFile || child instanceof TFolder) detach(child);
			}
		}
	};

	const app: ObsidianApp["Service"] = {
		vault: {
			getAbstractFileByPath: lookup,
			getMarkdownFiles: () =>
				[...index.values()].filter(
					(node): node is TFile =>
						node instanceof TFile && node.extension === "md",
				),
			read: async (file) => {
				const content = contents.get(file.path);
				if (content === undefined) throw new Error("File does not exist.");
				return content;
			},
			create,
			createBinary: async (raw, data) => createBinarySync(raw, data),
			createFolder,
			modify: async (file, data) => {
				if (!contents.has(file.path)) throw new Error("File does not exist.");
				contents.set(file.path, data);
			},
		},
		fileManager: {
			trashFile: async (file) => {
				const node = index.get(file.path);
				if (node === undefined) throw new Error("File does not exist.");
				trashed.push(file.path);
				detach(node);
			},
		},
		metadataCache: {
			getFileCache: (file) => {
				const content = contents.get(file.path);
				if (content === undefined) return null;
				const frontmatter = parseFrontmatter(content);
				return frontmatter === undefined ? {} : { frontmatter };
			},
		},
	};

	return {
		app,
		files: () => new Map(contents),
		binaries: () => new Map(binaries),
		folders: () =>
			[...index.entries()]
				.filter(([path, node]) => path !== "/" && node instanceof TFolder)
				.map(([path]) => path),
		trashed: () => [...trashed],
		read: (path) => contents.get(normalizePath(path)),
		move: (rawFrom, rawTo) => {
			const from = normalizePath(rawFrom);
			const content = contents.get(from);
			const node = index.get(from);
			if (content === undefined || node === undefined) {
				throw new Error(`No note at ${from}`);
			}
			detach(node);
			const to = normalizePath(rawTo);
			const parentPath = to.split("/").slice(0, -1).join("/");
			if (parentPath !== "" && !index.has(parentPath)) {
				createFolderSync(parentPath);
			}
			createSync(to, content);
		},
		seed: (raw, content) => {
			const path = normalizePath(raw);
			const parentPath = path.split("/").slice(0, -1).join("/");
			if (parentPath !== "" && !index.has(parentPath)) {
				createFolderSync(parentPath);
			}
			createSync(path, content);
		},
	};
};
