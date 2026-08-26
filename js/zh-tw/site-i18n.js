/* Shared zh-TW interface localization runtime. This is intentionally a classic script. */
"use strict";

(() => {
	const root = globalThis;
	const RE_PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9_.-]*)\}/g;

	function isObject (value) {
		return value != null && typeof value === "object" && !Array.isArray(value);
	}

	function escapeHtml (value) {
		return String(value)
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll(">", "&gt;")
			.replaceAll("\"", "&quot;")
			.replaceAll("'", "&#39;");
	}

	function interpolate (message, params, {isHtml = false} = {}) {
		if (!isObject(params)) return String(message);
		return String(message).replace(RE_PLACEHOLDER, (full, name) => {
			if (!Object.hasOwn(params, name)) return full;
			const value = params[name] == null ? "" : params[name];
			return isHtml ? escapeHtml(value) : String(value);
		});
	}

	function getDefaultIsDev () {
		if (root.IS_DEPLOYED === false) return true;
		const hostname = root.location?.hostname;
		return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
	}

	class SiteI18n {
		constructor ({data = null, isDev = getDefaultIsDev(), logger = null} = {}) {
			this._data = data || {
				_meta: {locale: "zh-TW", fallbackLocale: "en"},
				messages: {},
				english: {},
				fallbacks: {},
				htmlKeys: [],
			};
			this._isDev = !!isDev;
			this._logger = logger || root.console;
			this._missingKeys = new Set();
		}

		get locale () { return this._data?._meta?.locale || "zh-TW"; }

		get fallbackLocale () { return this._data?._meta?.fallbackLocale || "en"; }

		configure ({isDev, logger} = {}) {
			if (isDev != null) this._isDev = !!isDev;
			if (logger != null) this._logger = logger;
			return this;
		}

		setData (data) {
			if (!isObject(data)) throw new TypeError("SiteI18n data must be an object.");
			this._data = data;
			return this;
		}

		has (key) {
			return typeof this._data?.messages?.[key] === "string" && this._data.messages[key].length > 0;
		}

		hasEnglish (english) {
			return typeof this._data?.english?.[english] === "string";
		}

		getMissingKeys () {
			return [...this._missingKeys];
		}

		clearMissingKeys () {
			this._missingKeys.clear();
			return this;
		}

		_recordMissing (token) {
			if (!this._isDev) return;
			if (this._missingKeys.has(token)) return;
			this._missingKeys.add(token);

			const message = `[zh-TW i18n] Missing translation: ${token}`;
			if (typeof this._logger === "function") this._logger(message);
			else this._logger?.warn?.(message);
		}

		_getCallArgs (fallbackOrParams, maybeParams) {
			if (isObject(fallbackOrParams) && maybeParams == null) return {fallback: null, params: fallbackOrParams};
			return {
				fallback: fallbackOrParams == null ? null : String(fallbackOrParams),
				params: isObject(maybeParams) ? maybeParams : {},
			};
		}

		_t (key, fallbackOrParams, maybeParams, {isHtml = false} = {}) {
			const {fallback, params} = this._getCallArgs(fallbackOrParams, maybeParams);
			const translated = this._data?.messages?.[key];
			if (typeof translated === "string" && translated.length) return interpolate(translated, params, {isHtml});

			this._recordMissing(String(key));
			const englishFallback = fallback ?? this._data?.fallbacks?.[key] ?? String(key);
			return interpolate(englishFallback, params, {isHtml});
		}

		/** Translate a stable key. Signature: t(key, englishFallback?, params?). */
		t (key, fallbackOrParams = null, maybeParams = null) {
			return this._t(String(key), fallbackOrParams, maybeParams);
		}

		/** As t(), but preserve trusted catalog HTML and escape every interpolated value. */
		tHtml (key, fallbackOrParams = null, maybeParams = null) {
			return this._t(String(key), fallbackOrParams, maybeParams, {isHtml: true});
		}

		_tEnglish (english, params, {isHtml = false} = {}) {
			const source = String(english);
			const key = this._data?.english?.[source];
			if (typeof key === "string") return this._t(key, source, params, {isHtml});

			this._recordMissing(`english:${source}`);
			return interpolate(source, params, {isHtml});
		}

		/** Translate an existing English UI literal, falling back to that literal. */
		tEnglish (english, params = null) {
			return this._tEnglish(english, isObject(params) ? params : {});
		}

		/** As tEnglish(), but preserve trusted catalog HTML and escape substitutions. */
		tEnglishHtml (english, params = null) {
			return this._tEnglish(english, isObject(params) ? params : {}, {isHtml: true});
		}
	}

	root.SiteI18n = SiteI18n;
	root.I18nZhTwSite = new SiteI18n({data: root.SITE_I18N_ZH_TW_DATA});
})();
