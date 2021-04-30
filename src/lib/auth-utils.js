module.exports = (function () {
	"use strict";

	//----------------------------------------------------------------------------------------------------
	//
	//
	const JWTUtils = require("./jwt-utils.js");
	const UUID = require("uuid");
	const ERRORS = require('./error-codes.js');


	//----------------------------------------------------------------------------------------------------
	//
	//
	const TokenTypes = {
		IDENTITY: "identity",
		AUTHORIZATION: "authorization",
		ACCESS: "access",
		REFRESH: "refresh",
		LEGACY: "legacy",
	};

	//----------------------------------------------------------------------------------------------------
	//
	//
	function generateIdentityTokenV1(info) {
		let ttl = info.ttl || 365 * 86400 * 1000; // 365 days from now on (half a year).

		info = JSON.parse(JSON.stringify(info));
		info.authorization = UUID.v4();
		info.type = TokenTypes.IDENTITY;
		info.expiresAt = Date.now() + ttl; // 365 days from now on (half a year).

		return {
			token: generateToken(info),
			authorization: info.authorization,
			expiresAt: info.expiresAt,
			ttl: ttl
		};
	}

	function generateAuthorizationTokenV1(info) {
		info = JSON.parse(JSON.stringify(info));
		info.authorization = UUID.v4();
		info.type = TokenTypes.AUTHORIZATION;
		info.expiresAt = Date.now() + 300 * 1000; // 5 minutes from now on.

		return generateToken(info);
	}

	function generateRefreshTokenV1(info) {
		info = JSON.parse(JSON.stringify(info));
		info.type = TokenTypes.REFRESH;

		return generateToken(info);
	}

	function generateAccessTokenV1(info) {
		info = JSON.parse(JSON.stringify(info));
		info.type = TokenTypes.ACCESS;
		info.authorization = info.authorization || UUID.v4();
		info.expiresAt = Date.now() + 365 * 86400 * 1000; // 365 * 24 hours.

		return generateToken(info);
	}

	function generateToken (info) {
		let token = {
			v: 1,
			authorization: info.authorization,
			type: info.type,
			email: info.email,
			checksum: undefined,
			extra: info.extra || undefined
		};

		if (info.hasOwnProperty("expiresAt")) {
			token.expiresAt = info.expiresAt;
		}

		token.checksum = generateChecksum({
			type: token.type,
			clientId: info.clientId || "",
			email: token.email,
			expiresAt: token.expiresAt || "",
		});

		return JWTUtils.encodeJwt(token, undefined, {noTimestamp: true});
	}

	function generateChecksum (info) {
		return JWTUtils.md5(`:${info.type}:${info.clientId}:${info.email}:${info.expiresAt}:513D37BB-143B-4A41-9291-6B8F7F9CA626`);
	}

	//----------------------------------------------------------------------------------------------------
	//
	//
	function decodeToken (encodedToken) {
		return JWTUtils.decodeJwt(encodedToken);
	}

	function validateToken (decodedToken, clientId) {
		if (!decodedToken || decodedToken.v !== 1 || !decodedToken.authorization || !decodedToken.email) {
			return false;
		}

		if (decodedToken.type !== TokenTypes.REFRESH && decodedToken.expiresAt < Date.now()) {
			return false;
		}

		switch (decodedToken.type) {
			case TokenTypes.IDENTITY:
			case TokenTypes.AUTHORIZATION:
			case TokenTypes.ACCESS:
			case TokenTypes.REFRESH:
				break;
			default:
				return false;
		}

		if (clientId !== undefined) {
			let checksum = generateChecksum({
				type: decodedToken.type,
				clientId: clientId || "",
				email: decodedToken.email,
				expiresAt: decodedToken.expiresAt || "",
			});

			if (checksum !== decodedToken.checksum) {
				return false;
			}
		}

		return true;
	}

	//----------------------------------------------------------------------------------------------------
	//
	//
	function authenticateHttpRequestV1 (req, res, next) {
		let token = extractToken(req);
		token = decodeToken(token);
		if (!validateToken(token) || !token.extra || !token.extra.length > 0) {
			return httpJSONResponse(res, ERRORS.AUTH_FAIL);
		}

		req.accessToken = token;

		next();
	}


	//----------------------------------------------------------------------------------------------------
	//
	//

	function extractToken(req) {
		if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
			return req.headers.authorization.split(' ')[1];
		} else if (req.query) {
			return req.query.token || req.query.refresh_token || req.query.authorization_token || req.query.access_token;
		}

		return null;
	}

	function httpJSONResponse(res, param) {
		if (param.statusCode) {
			res.statusCode = param.statusCode
		}
		return res.json(param);
	}


	//----------------------------------------------------------------------------------------------------
	//
	//
	return {
		TokenTypes: TokenTypes,
		generateIdentityTokenV1: generateIdentityTokenV1,
		generateAuthorizationTokenV1: generateAuthorizationTokenV1,
		generateRefreshTokenV1: generateRefreshTokenV1,
		generateAccessTokenV1: generateAccessTokenV1,
		decodeToken: decodeToken,
		validateToken: validateToken,
		authenticateHttpRequestV1: authenticateHttpRequestV1,
		httpJSONResponse:httpJSONResponse
	};

} ());