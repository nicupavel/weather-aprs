module.exports = (function () {

	"use strict";

	//--------------------------------------------------------------------------------------
	//
	//
	const Crypto = require("crypto");
	const JWT = require("jsonwebtoken");
	const m_jwtSecret = "bd1ce43b-d2ad-47e4-b3ad-261b7d51f5d5";

	//--------------------------------------------------------------------------------------
	//
	//
	function encodeJwt (toEncode, signature, options) {
		if (toEncode) {
			let secret = signature ? (m_jwtSecret + "-" + signature) : m_jwtSecret;

			options = options || {};
			if (!options.hasOwnProperty("noTimestamp")) {
				options.noTimestamp = true;
			}

			return JWT.sign(toEncode, secret, options);
		}
		return null;
	}

	function decodeJwt (toDecode, signature, options) {
		if (toDecode) {
			try {
				let secret = signature ? (m_jwtSecret + "-" + signature) : m_jwtSecret;
				return JWT.verify(toDecode, secret, options);
			} catch (e) {
			}
		}
		return null;
	}

	//--------------------------------------------------------------------------------------
	//
	//
	function md5 (toHash) {
		let checksum = Crypto.createHash("md5");
		checksum.update(toHash);
		return checksum.digest("hex");
	}

	function encodeBase64 (toEncode) {
		return (new Buffer(toEncode)).toString("base64");
	}

	function decodeBase64 (toDecode) {
		return (new Buffer(toDecode, "base64")).toString("ascii");
	}

	//--------------------------------------------------------------------------------------
	//
	//
	return {
		encodeJwt: encodeJwt,
		decodeJwt: decodeJwt,
		md5: md5,
		encodeBase64: encodeBase64,
		decodeBase64: decodeBase64
	};
} ());
