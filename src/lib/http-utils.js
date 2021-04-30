module.exports = (function () {
	"use strict";


	//----------------------------------------------------------------------------------------------------
	//
	//

	function allowCORS(req, res, next) {
		res.header("Access-Control-Allow-Origin", "*");
		res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
		res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
		next();
	}

	//----------------------------------------------------------------------------------------------------
	//
	//
	return {
		allowCORS: allowCORS
	}

} ())