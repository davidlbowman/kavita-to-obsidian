/**
 * Pure template engine with Mustache-like syntax for formatting annotations.
 *
 * @module
 */
import { DEFAULT_ANNOTATION_TEMPLATE } from "../schemas.js";

export { DEFAULT_ANNOTATION_TEMPLATE };

/**
 * Validate template syntax by checking that all `{{#if}}` blocks have matching `{{/if}}` closers.
 *
 * @since 1.2.0
 * @category Template
 */
export const validateTemplate = (
	template: string,
): { readonly valid: boolean; readonly error?: string } => {
	let depth = 0;
	const ifPattern = /\{\{#if\s+\w+\}\}/g;
	const endIfPattern = /\{\{\/if\}\}/g;

	const opens = template.match(ifPattern) ?? [];
	const closes = template.match(endIfPattern) ?? [];

	const tokens: Array<{
		readonly type: "open" | "close";
		readonly index: number;
	}> = [];

	for (const match of template.matchAll(ifPattern)) {
		tokens.push({ type: "open", index: match.index ?? 0 });
	}
	for (const match of template.matchAll(endIfPattern)) {
		tokens.push({ type: "close", index: match.index ?? 0 });
	}

	tokens.sort((a, b) => a.index - b.index);

	for (const token of tokens) {
		if (token.type === "open") {
			depth++;
		} else {
			depth--;
		}
		if (depth < 0) {
			return {
				valid: false,
				error: "Unexpected {{/if}} without matching {{#if}}",
			};
		}
	}

	if (depth > 0) {
		const unclosed = opens.length - closes.length;
		return {
			valid: false,
			error: `Unclosed {{#if}} block: ${unclosed} opening tag(s) without matching {{/if}}`,
		};
	}

	return { valid: true };
};

/**
 * Process a single `{{#if var}}...{{/if}}` block, handling nested blocks recursively.
 * Returns the processed string with conditional blocks resolved.
 */
const processConditionals = (
	template: string,
	context: Record<string, string | number>,
): string => {
	const ifOpenPattern = /\{\{#if\s+(\w+)\}\}/;

	let result = template;
	let match = ifOpenPattern.exec(result);

	while (match !== null) {
		const startIndex = match.index;
		const varName = match[1];
		const afterOpen = startIndex + match[0].length;

		let depth = 1;
		let searchIndex = afterOpen;

		while (depth > 0 && searchIndex < result.length) {
			const nextOpen = result.indexOf("{{#if ", searchIndex);
			const nextClose = result.indexOf("{{/if}}", searchIndex);

			if (nextClose === -1) {
				return result;
			}

			if (nextOpen !== -1 && nextOpen < nextClose) {
				depth++;
				searchIndex = nextOpen + 1;
			} else {
				depth--;
				if (depth === 0) {
					const innerContent = result.slice(afterOpen, nextClose);
					const endIndex = nextClose + "{{/if}}".length;

					const value = varName !== undefined ? context[varName] : undefined;
					const isTruthy =
						value !== undefined &&
						value !== null &&
						value !== "" &&
						value !== 0;

					const replacement = isTruthy
						? processConditionals(innerContent, context)
						: "";

					result =
						result.slice(0, startIndex) + replacement + result.slice(endIndex);
					break;
				}
				searchIndex = nextClose + 1;
			}
		}

		match = ifOpenPattern.exec(result);
	}

	return result;
};

/**
 * Render a Mustache-like template with the given context.
 *
 * Supports `{{variable}}` interpolation and `{{#if variable}}...{{/if}}` conditional blocks.
 * Missing variables are replaced with empty strings. Malformed templates return empty string
 * with a console warning.
 *
 * @since 1.2.0
 * @category Template
 */
export const renderTemplate = (
	template: string,
	context: Record<string, string | number>,
): string => {
	const validation = validateTemplate(template);
	if (!validation.valid) {
		return "";
	}

	const afterConditionals = processConditionals(template, context);

	const afterInterpolation = afterConditionals.replace(
		/\{\{(\w+)\}\}/g,
		(_match, key: string) => {
			const value = context[key];
			if (value === undefined || value === null) {
				return "";
			}
			return String(value);
		},
	);

	return afterInterpolation
		.replace(/\n{3,}/g, "\n\n")
		.replace(/^\n+/, "")
		.replace(/\n+$/, "");
};
