/*  DepressedPress.com, DP_AJAX

Author: Jim Davis, the Depressed Press
Created: July 18, 2012
Contact: webmaster@depressedpress.com
Website: www.depressedpress.com

Full documentation can be found at:
http://depressedpress.com/javascript-extensions/

DP_AJAX regulates and manages multiple HTTP requests and XML responses.

	- Built-in Debugging requires DP_Debug (available from depressedpress.com).


+ + + + + + + + LEGAL NOTICE + + + + + + + +

Copyright (c) 1996-2014, The Depressed Press (depressedpress.com)

All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

+) Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

+) Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

+) Neither the name of the THE DEPRESSED PRESS (DEPRESSEDPRESS.COM) nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

*/

	// Manage other, optional, DP components
	//

	// Set up DP_Debug (prevents errors if DP_Debug is not present
try {  DP_Debug.isEnabled()  } catch (e) {  DP_Debug = new Object(); DP_Debug.isEnabled = function() { return false }  };


	// Create the Root DP_AJAX object
	//
DP_AJAX = { };

	// Set up some Counters to be used as Instance Identifiers
DP_AJAX.PoolCnt = 0;
DP_AJAX._getPoolID = function() { DP_AJAX.PoolCnt = DP_AJAX.PoolCnt + 1; return DP_AJAX.PoolCnt; };
DP_AJAX.RequestCnt = 0;
DP_AJAX._getRequestID = function() { DP_AJAX.RequestCnt = DP_AJAX.RequestCnt + 1; return DP_AJAX.RequestCnt; };



	// DP_AJAX.createPool Method
	// Returns an instance of a request Pool.
	//
DP_AJAX.createPool = function( CallerCount, Interval, DefaultTimeout, DefaultMaxAttempts ) {

		// Manage arguments.
		//
		// CallerCount
	if ( typeof CallerCount != "number" || CallerCount < 1 ) {  CallerCount = 4  };
		// Interval
	if ( typeof Interval != "number" || Interval < 1 ) {  Interval = 200  };
		// DefaultTimeout (in seconds)
	if ( typeof DefaultTimeout != "number" || DefaultTimeout < 0 ) {  DefaultTimeout = 0  };
	DefaultTimeout * 1000;
		// MaxRequestAttempts
	if ( typeof DefaultMaxAttempts != "number" || DefaultMaxAttempts < 1 ) {  DefaultMaxAttempts = 0  };


		// The Pool Constructor
		//
	function Pool( CallerCount, Interval, DefaultTimeout, DefaultMaxAttempts ) {

			// Set arguments
		this.Interval = Interval;
		this.DefaultTimeout = DefaultTimeout;
		this.DefaultMaxAttempts = DefaultMaxAttempts

			// Set a Unique ID for the Pool
		this.ID = "DP_AJAX_Pool_" + DP_AJAX._getPoolID();

			// Create a pool of Caller Objects
		this.Callers = new Array();

			// Create the Caller Objects
		var CurInstance;
		for (var Cnt = 0; Cnt < CallerCount; Cnt++) {
			CurInstance = new Caller();
			CurInstance.ID = this.ID + "_Caller" + Cnt;
			if ( CurInstance ) {
				this.Callers[this.Callers.length] = CurInstance;
			} else {
				throw new Error("DP_RequestPool was unable to instantiate compatible HTTPRequest objects.");
			};
		};

			// Create a Queue for Calls
		this.Calls = new Array();

			// Add Debugging
		if ( DP_Debug.isEnabled() ) {  DP_Debug.logger("Request Pool created.<br>" + this.Callers.length + " " + this.Callers[0].Type + " objects in pool.<br>Default Max Request Attempts: " + this.DefaultMaxAttempts + ".<br>Default Timeout: " + this.DefaultTimeout + ".", this.ID)  };

			// Start Polling
		this.start();

			// Add Debugging
		if ( DP_Debug.isEnabled() ) {  DP_Debug.logger("Request Pool polling started (" + this.Interval + " ms).", this.ID)  };


			// Private constructor for Caller Objects
			//
		function Caller() {

				// Default the vars
			var CurInstance = null;
			var CurInstanceType = null;
			var CurRequester = null;
				// Attempt to find an instance of the request object that works
			try{
				CurInstance = new XMLHttpRequest();
				CurInstanceType = "XMLHttpRequest (Native)";
			} catch(e){
				var IDs = [
					'MSXML2.XMLHTTP.6.0',
					'MSXML2.XMLHTTP.3.0',
					'MSXML2.XMLHTTP',
					'Microsoft.XMLHTTP'
					];
				for ( var Cnt = 0; Cnt < IDs.length; Cnt++ ) {
					try {
						CurInstance = new ActiveXObject(IDs[Cnt]);
						CurInstanceType = IDs[Cnt] + " (ActiveX)";
						break;
					} catch(e) {};
				};
			};

				// Caller abort method
			this.abort = function( ClearReadyStateChange ) {
					// Manage ReadyStateChange
				if ( typeof ClearReadyStateChange != "boolean" ) { ClearReadyStateChange = false };
				if ( ClearReadyStateChange ) { this.Ob.onreadystatechange = function() { } };
					// Reset properties
				this.Ob.abort();
				this.Call = null;
				this.StartTime = null;
			};


				// Set up the Object
			if ( CurInstance ) {
				this.Ob = CurInstance;
				this.Type = CurInstanceType;
				this.Call = null;
				this.StartTime = null;
				this.Name = "";
					// Return the Requester
				return this;
			} else {
					// Return null
				return null;
			};

		};


	};


		// DP_RequestPool.start() Method
		//
	Pool.prototype.start = function() {

			// Set a proxy function to maintain scoping when called in the context of Window
		var CurPool = this;
		var PollerProxy = function() {  CurPool.manageCalls()  };
		this.PollerID = window.setInterval(PollerProxy, CurPool.Interval);

			// Add Debugging
		if ( DP_Debug.isEnabled() ) {  DP_Debug.logger("Request Pool polling started (" + this.Interval + " ms).", this.ID)  };

			// Return a reference to the pool (for method chaining)
		return this;

	};


		// DP_RequestPool.stop() Method
		//
	Pool.prototype.stop = function() {

			// Clear the Interval
		window.clearInterval(this.IntervalID);

			// Add Debugging
		if ( DP_Debug.isEnabled() ) {  DP_Debug.logger("Request Pool polling stopped.", this.ID)  };

			// Return a reference to the pool (for method chaining)
		return this;

	};


		// DP_RequestPool.queueLength() Method
		//
	Pool.prototype.queueLength = function() {

			// Return the number of calls
		return this.Calls.length;

	};


		// DP_RequestPool.isBusy() Method
		//
	Pool.prototype.isBusy = function() {

			// Loop over the Callers
		for ( var Cnt = 0; Cnt < this.Callers.length; Cnt++ ) {
			if ( this.Callers[Cnt].Ob.readyState != 0 && this.Callers[Cnt].Ob.readyState != 4 ) {
					// An Object is "busy"
				return true;
			};
		};
			// No objects were in the "busy" states
		return false;

	};


		// DP_RequestPool.clear Method
		//
	Pool.prototype.clear = function( AbortRunningRequests ) {

			// Manage Arguments
		if ( typeof AbortRunningRequests != "boolean" ) {  AbortRunningRequests = false  };

			// Abort all queued Requests
		for ( var Cnt = 0; Cnt < this.Calls.length; Cnt++ ) {
			CurCall = this.Calls[Cnt];
				// Abort the assciated request
			CurCall.Request.abort();
				// Pull the Call off the stack
			this.Calls.shift();
		};

			// Kill running requests
		if ( AbortRunningRequests ) {
			for ( var Cnt = 0; Cnt < this.Callers.length; Cnt++ ) {
				CurCaller = this.Callers[Cnt];
					// Abort the request (this will call the onReadyStateChange handler)
				CurCaller.abort(true);
			};
		};

			// Add Debugging
		if ( DP_Debug.isEnabled() ) {
			if ( AbortRunningRequests ) {
				DP_Debug.logger("Request Pool queued cleared and running requests aborted.", this.Name);
			} else {
				DP_Debug.logger("Request Pool queued cleared.", this.Name);
			};
		};

			// Return a reference to the pool (for method chaining)
		return this;

	};


		// DP_RequestPool.addRequest() Method
		//
	Pool.prototype.addRequest = function( Request ) {

			// Check argument
		if ( typeof Request != "object" ) {
			throw new Error("The addRequest() method was called with incorrect arguments.  RequestPool (" + this.ID + ").");
		};

			// Check that the request has calls
		if ( Request.Calls.length == 0 ) {
			throw new Error("Request (" + Request.ID + ") has no Calls defined and can not be added to RequestPool (" + this.ID + ").");
		};

			// Loop over the calls in the request and queue them
		for ( var Cnt = 0; Cnt < Request.Calls.length; Cnt++ ) {

				// Get the Current Call
			var CurCall = Request.Calls[Cnt];
				// If needed update the request with defaults
			if ( !CurCall.Timeout ) {  CurCall.Timeout = this.DefaultTimeout  };
			if ( !CurCall.MaxAttempts ) {  CurCall.MaxAttempts = this.DefaultMaxAttempts  };

				// Only put non null calls into the queue
			if ( CurCall.URL != null ) {
					// Add the Call to the Queue
				this.Calls.push(CurCall);
			};

		};

			// Add Debugging
		if ( DP_Debug.isEnabled() ) {
			DP_Debug.logger("Request (" + Request.Name + ") added (" + Request.Calls.length + " Calls).", this.Name)
			DP_Debug.dump(Request);
		};


			// Update Request Status
		Request.Status = "Processing";

			// Return a reference to the pool (for method chaining)
		return this;

	};


		// DP_RequestPool.manageCalls
		//
	Pool.prototype.manageCalls = function() {

			// Set some Shortcuts
		var Callers = this.Callers;
		var Calls = this.Calls;

			// Try to get an available ObInstance
		var CurCaller, CurCallerID;
		for ( var Cnt = 0; Cnt < Callers.length; Cnt++ ) {

			CurCaller = Callers[Cnt];

			if ( !CurCaller.Call && CurCaller.Ob.readyState == 0 && Calls.length > 0) {

					// Get the Call
				CurCaller.Call = Calls.shift();
					// Set the time the call began
				CurCaller.StartTime = new Date();

					// Private function to ensure proper dereferencing while in the loop
				function setHandler( ThisPool, ThisCaller ) {
					CurCaller.Ob.onreadystatechange = function() {  ThisPool.readyStateHandler(ThisCaller)  };
				};
					// Set the state change handler
				var CurThis = this;
				setHandler(CurThis, CurCaller);

					// Open the Request
				CurCaller.Ob.open( CurCaller.Call.Method, CurCaller.Call.URL, true );
					// Set Headers, if needed
				for ( var CurProp in CurCaller.Call.Headers ) {
					CurCaller.Ob.setRequestHeader(CurProp, CurCaller.Call.Headers[CurProp]);
				};
					// Send the data
				CurCaller.Ob.send(CurCaller.Call.Parameters);

					// Add Debugging
				if ( DP_Debug.isEnabled() ) {  DP_Debug.logger("Request Sent using Object " + CurCaller.ID + ".<br>" + CurCaller.Call.URL, this.ID)  };

			} else {

					// Determine if the current Caller has a Timeout
				if ( CurCaller.Call && CurCaller.Call.Timeout > 0 ) {

						// Determine if the current caller exceeded its Timeout
					if ( ( new Date().getTime() - CurCaller.StartTime.getTime() ) > CurCaller.Call.Timeout ) {

							// If needed, retry the request
						if ( CurCaller.Call.Attempts < CurCaller.Call.MaxAttempts ) {
								// Abort the instance to clear it
							CurCaller.abort(true);
								// Update the Attempts
							CurCaller.Call.Attempts = CurCaller.Call.Attempts + 1;
								// Retry the Request
							this.Calls.push(CurCaller.Call);
						} else {
								// Abort the instance to clear it
							CurCaller.abort(false);
						};

							// Add Debugging
						if ( DP_Debug.isEnabled() ) {  DP_Debug.logger("Request Timed Out.<br>" + CurCaller.Call.URL, this.Name)  };

					};

				};

			};

		};

			// Return
		return true;

	};


		// DP_RequestPool.readyStateHandler
		//
	Pool.prototype.readyStateHandler = function(Caller) {

			// If the ReadyState is 0, return immediately
		if ( Caller.Ob.readyState == 0 ) {
			return true;
		};

			// Get shortcuts
		var CurCaller = Caller;
		var CurCall = CurCaller.Call;
		var CurRequest = CurCaller.Call.Request;


			// If the request has been aborted, kill the call.
		if ( CurRequest.status == "Aborted" ) {
				// Abort the call
			CurCaller.abort();
				// Return
			return true;
		};

			// Run if the call is done (readyState "4" means the call is complete)
		if ( CurCaller.Ob.readyState == 4 ) {

				// Update the Call Status
			CurCall.Status = CurCaller.Ob.status;
			CurCall.StatusText = CurCaller.Ob.statusText;
			CurCall.ResponseText = CurCaller.Ob.responseText;
			CurCall.ResponseXML = CurCaller.Ob.responseXML;
			CurCall.ResponseHeaders = CurCaller.Ob.getAllResponseHeaders();
			CurCall.ContentType = CurCaller.Ob.getResponseHeader("Content-Type");

				// If there was an error, manage reattempts and AbortOnError
			if ( CurCaller.Ob.status != "200" ) {

					// See if we have more attempts left
				if ( CurCall.Attempts <= CurCall.MaxAttempts ) {

						// Abort the caller
					CurCaller.abort(true);
						// Update the Attempts
					CurCall.Attempts = CurCall.Attempts + 1;
						// Reset the Call
					CurCall.Status = null;
					CurCall.StatusText = null;
					CurCall.ResponseText = null;
					CurCall.ResponseXML = null;
					CurCall.ResponseHeaders = null;
						// Retry the Call
					this.Calls.push(CurCall);

				} else {

						// Test "AbortOnError"
					if ( CurRequest.AbortOnError ) {

							// Create the response
						var Response = createResponse(CurRequest);
							// Run the Error Handler
						if ( typeof CurRequest.ErrorHandler == "function" ) {
							RunHandler(Response, CurRequest.ErrorHandler, CurRequest.ErrorHandlerArgs );
						};
							// Abort the request
						CurRequest.abort();

					};

				};

			};

				// Determine if all the Calls in the Request have completed
			var RequestComplete = true;
			var RequestError = false;
			for ( var Cnt = 0; Cnt < CurRequest.Calls.length; Cnt++ ) {

				if ( CurRequest.Calls[Cnt].Status == null ) {
					RequestComplete = false;
				} else if ( CurRequest.Calls[Cnt].Status != "200" ) {
					RequestError = true;
				};
			};

				// Determine which handlers to call

				// Request is complete and contains an error
			if ( RequestComplete && RequestError ) {

					// Create the response
				var Response = createResponse(CurRequest);
					// Call the Error handler (if any)
				if ( typeof CurRequest.ErrorHandler == "function" ) {
					runHandler( Response, CurRequest.ErrorHandler, CurRequest.ErrorHandlerArgs );
				};
					// Set Request Status
				CurRequest.status = "CompleteWithErrors";
					// Debugging
				if ( DP_Debug.isEnabled() ) {
					DP_Debug.logger("Request (" + CurRequest.ID + ") Completed with Errors.", this.ID)
					DP_Debug.dump(Response);
				};


				// Request is complete and contains no errors
			} else if( RequestComplete && !RequestError ) {

					// Create the response
				var Response = createResponse(CurRequest);
					// Call the Success handler (if any)
				if ( typeof CurRequest.SuccessHandler == "function" ) {
					runHandler( Response, CurRequest.SuccessHandler, CurRequest.SuccessHandlerArgs );
				};
					// Set request status
				CurRequest.status = "Complete";
					// Debugging
				if ( DP_Debug.isEnabled() ) {
					DP_Debug.logger("Request (" + CurRequest.ID + ") Completed.", this.ID)
					DP_Debug.dump(Response, CurRequest.ID);
				};

			};

				// Abort the call
			CurCaller.abort(false);

		};

			// Return
		return true;


			// Private function to run handlers
		function runHandler( Response, Handler, HandlerArgs ) {

				// Construct the handler
			var ArgString = [];
			for ( var Cnt = 0; Cnt < HandlerArgs.length; Cnt++ ) {
				ArgString[Cnt] = "HandlerArgs[" + Cnt + "]";
			};
			var HandlerString = "";
				if ( ArgString.length == 0 ) {
					HandlerString += "Handler(Response);";
				} else {
					HandlerString += "Handler(Response, " + ArgString.join(", ") + ");";
				};
				// Run the handler
			eval(HandlerString);

		};

			// Private function to create Response
		function createResponse( Request ) {

				// Set a short cut
			var Calls = Request.Calls;
				// Set the Response array
			var Response = [];

				// Simple or complex responses
			if ( Request.SimpleResponses ) {

					// Construct Response
				for ( var Cnt = 0; Cnt < Calls.length; Cnt++ ) {

						// If the Content-Type indicates XML, send ResponseXML, otherwise ResponseText
					if ( Calls[Cnt].ContentType.indexOf("text/xml") >= 0 || Calls[Cnt].ContentType.indexOf("application/xml") >= 0 ) {
						Response[Cnt] = Calls[Cnt].ResponseXML;
					} else {
						Response[Cnt] = Calls[Cnt].ResponseText;
					};

				};

			} else {

					// Construct Response
				for ( var Cnt = 0; Cnt < Calls.length; Cnt++ ) {

						// Extract the Headers to an object
					var ResponseHeaders = {};
					var AllHeaders = Calls[Cnt].ResponseHeaders.split("\n");
					for ( var iCnt=0; iCnt < AllHeaders.length; iCnt++ ) {
						CurHeader = AllHeaders[iCnt].split(": ");
						if ( CurHeader.length == 2 ) {
							ResponseHeaders[CurHeader[0]] = CurHeader[1].substr(0, CurHeader[1].length-1);
						};
					};

						// Package the data into an object
					Response[Cnt] = {
						"Status" : Calls[Cnt].Status,
						"StatusText" : Calls[Cnt].StatusText,
						"ResponseText" : Calls[Cnt].ResponseText,
						"ResponseXML" : Calls[Cnt].ResponseXML,
						"Headers" : ResponseHeaders
					};

				};

			};

				// If there is only response, elimate the array and send just the single response directly.
			if ( Response.length == 1 ) {
				Response = Response[0];
			};

				// Return the Response
			return Response;

		};

	};

		// Create and Return the pool
		//
	return new Pool( CallerCount, Interval, DefaultTimeout, DefaultMaxAttempts );

};



	// DP_AJAX.createRequest Method
	// Returns an instance of a Request.
	//

DP_AJAX.createRequest = function( SuccessHandler, SuccessHandlerArgs, ErrorHandler, ErrorHandlerArgs, AbortOnError, SimpleResponses ) {

		// Manage arguments.
		//
		// SuccessHandler
	if ( typeof SuccessHandler != "function" ) {  SuccessHandler = null };
		// SuccessHandlerArgs
		// An array of arguments passed to the Success Handler, may be empty.
	if ( typeof SuccessHandlerArgs != "object" || SuccessHandlerArgs == null ) {  SuccessHandlerArgs = []  };
		// ErrorHandler
		// A function that will be called on the success of the request.  May be null.
	if ( typeof ErrorHandler != "function" ) {  ErrorHandler = null  };
		// ErrorHandlerArgs
		// An array of arguments passed to the Error Handler, may be empty.
	if ( typeof ErrorHandlerArgs != "object" || ErrorHandlerArgs == null ) { ErrorHandlerArgs = []  };
		// AbortOnError
	if ( typeof AbortOnError != "boolean" ) { AbortOnError = true };
		// SimpleResponses
	if ( typeof SimpleResponses != "boolean" ) { SimpleResponses = true };


		// The Request Constructor
		//
	function Request( SuccessHandler, SuccessHandlerArgs, ErrorHandler, ErrorHandlerArgs, AbortOnError, SimpleResponses ) {

			// Set arguments
		this.SuccessHandler = SuccessHandler;
		this.SuccessHandlerArgs = SuccessHandlerArgs;
		this.ErrorHandler = ErrorHandler;
		this.ErrorHandlerArgs = ErrorHandlerArgs;
		this.AbortOnError = AbortOnError;
		this.SimpleResponses = SimpleResponses;

			// Set a Unique ID for the Request
		this.ID = "DP_AJAX_Request_" + DP_AJAX._getRequestID();

			// Set up Calls Array
		this.Calls = [];

			// Set a pointer to the RequestPool
		this.RequestPool = null;

			// Set the Status Property to "Initialized"
		this.Status = "Initialized";

	};


		// Request.addCall() Method
		//
	Request.prototype.addCall = function( Method, URL, Parameters, Headers, Timeout, MaxAttempts ) {

			// Manage arguments.
			//

			// Headers
			// Must come first as it may be modified by certain arguments (specifically "Method")
		if ( typeof Headers != "object" ) {  Headers = new Object()  };
			// Method
			// Defaults to "GET"
		if ( Method.toLowerCase() == "get" ) {
			Method = "GET";
		} else if ( Method.toLowerCase() == "post" ) {
			Method = "POST";
			Headers["Content-Type"] = "application/x-www-form-urlencoded";
		} else if ( Method.toLowerCase() == "soap" ) {
			Method = "POST";
			Headers["Content-Type"] = "text/xml; charset=utf-8";
		} else if ( Method.toLowerCase() == "soap12" ) {
			Method = "POST";
			Headers["Content-Type"] = "application/soap+xml";
		} else {
			Method = "GET";
		};
			// URL (Deafults to empty, will output a null result to the response.)
		if ( typeof URL != "string" ) {  URL = ""  };
			// ParameterList
			// If present turn the Parameters object into a string for use on the command line.
		var ParametersList = "";
		if ( typeof Parameters == "object" ) {
			for ( var CurProp in Parameters ) {
				if ( typeof Parameters[CurProp] != "function" ) {
					ParametersList += CurProp + "=" + escape(Parameters[CurProp]) + "&";
				};
			};
		} else {
			ParametersList = Parameters;
		};
			// Timeout
			// Converts to seconds.  Defaults to null, which inherits default Pool value.
		if ( typeof Timeout != "number" ) {  Timeout = null  } else {  Timeout = Timeout * 1000  };
			// MaxAttempts
			// Defaults to null.
		if ( typeof MaxAttempts != "number" ) {  MaxAttempts = null  };


			// Set a Unique ID for the Request
		var CallID = this.ID + "_Call" + (this.Calls.length + 1);

			// If the URL of the Call if empty, create a faux call to maintain position
		if ( URL == "" ) {

				// Fake the call
				//
			this.Calls[this.Calls.length] = {
				"Method" : null,
				"URL" : null,
				"Parameters" : null,
				"Headers" : null,
				"Timeout" : Timeout,
				"MaxAttempts" : MaxAttempts,
				"Attempts" : 1,
				"ID" : CallID,
				"Request" : this,
				"Status" : 200,
				"StatusText" : "Null call",
				"ResponseText" : null,
				"ResponseXML" : null,
				"ResponseHeaders" : null,
				"ContentType" : ""
				};

		} else {

				// Add the current call to the call stack
				//
			this.Calls[this.Calls.length] = {
				"Method" : Method,
				"URL" : URL,
				"Parameters" : ParametersList,
				"Headers" : Headers,
				"Timeout" : Timeout,
				"MaxAttempts" : MaxAttempts,
				"Attempts" : 0,
				"ID" : CallID,
				"Request" : this,
				"Status" : null,
				"StatusText" : null,
				"ResponseText" : null,
				"ResponseXML" : null,
				"ResponseHeaders" : null,
				"ContentType" : null
				};

		};

			// Return
		return this;

	};


		// Request.abort() Method
		//
	Request.prototype.abort = function() {

			// If the request has been aborted previously (or has not been added to a request pool), we're done
		if ( this.status == "Aborted" || this.RequestPool == null ) {
				// Return
			return true;
		};

			// Set the Status Property to "Aborted"
		this.Status = "Aborted";

			// Kill running calls
		var CurCallers = this.RequestPool.Callers;
		for ( var Cnt = 0; Cnt < CurCallers.length; Cnt++ ) {
				// Abort the request
			this.CurCallers[Cnt].abort(true);
		};

	};


		// Create and Return the pool
		//
	var CurRequest = new Request( SuccessHandler, SuccessHandlerArgs, ErrorHandler, ErrorHandlerArgs, AbortOnError, SimpleResponses );
	return CurRequest;

};



	// DP_AJAX.createXML Method
	// Returns an (empty) XML DOM Document
	//
DP_AJAX.createXML = function( RootName, RootNamespaceURL ) {

		// Manage arguments.
		//
		// RootPrefix (a "psuedoargument" that may be passed as part of the RootName and is dependent on RootNamespaceURL)
		// Use Firefox Default (since it's as good as anything else)
	var RootPrefix = "a0";
		// RootName
		// May include RootPrefix in the form "RootPrefix:RootName"
	if ( typeof RootName != "string" ) {
		RootName = ""
	} else if ( RootName.indexOf(':') >= 0 ) {
		RootPrefix = RootName.split(":")[0];
		RootName = RootName.split(":")[1];
	};
		// RootNamespaceURL
	if ( typeof RootNamespaceURL != "string" ) { RootNamespaceURL = "" };
		// If there's no RootNameSpace there's no need for a prefix so toss it away
	if( !RootNamespaceURL ) {
		RootPrefix = "";
	};


		// Default vars
	var CurInstance, CurInstanceType;

		// Create the Document
	if ( document.implementation && document.implementation.createDocument ) {

			// W3C standard Method
		CurInstance = document.implementation.createDocument(RootNamespaceURL, RootName, null);
		CurInstanceType = "W3C Standard (Native)";

	} else {

			// IE Method
		var IDs = [
			'Msxml2.DOMDocument.6.0',
			'Msxml2.DOMDocument.4.0',
			'Msxml2.DOMDocument.3.0',
			'Msxml.DOMDocument'
			];
		for ( var Cnt = 0; Cnt < IDs.length; Cnt++ ) {
			try {
				CurInstance = new ActiveXObject(IDs[Cnt]);
				CurInstanceType = IDs[Cnt] + " (ActiveX)";
				break;
			} catch(e) {};
		};

			// Add the root tag, if present
		if ( RootName ) {
				//Format the Namespace
			var RootTag = "<" + (RootPrefix?(RootPrefix + ":"):"") +  RootName + ( RootNamespaceURL?(" xmlns:" + RootPrefix + '="' + RootNamespaceURL + '"'):"") + "/>";
				// Add the Root tag to the document
			CurInstance.loadXML(RootTag);
		};

	};

		// Return the (empty) Document
	return CurInstance;

};


	// DP_AJAX.syncLoadXML Method
	// Returns a XML DOM Document with the content from URL
	// (Super simple and dumb - use a DP_AJAX pool for more control.)
	//
DP_AJAX.loadXML = function( URL, Async, Handler ) {

		// Manage Arguments
	if( typeof Async != "boolean" ) { Async = true };

		// Create a Document
	var CurDoc = DP_AJAX.createXML();

		// Determine how to make the call
	if ( Async ) {

			// Load asynchronously
		CurDoc.async = true;

			// With createDocument we have the onload method, otherwise we use onreadystatechange
		if ( document.implementation && document.implementation.createDocument ) {
			CurDoc.onload = function() { Handler(CurDoc); };
		} else {
			CurDoc.onreadystatechange = function() { if ( CurDoc.readyState == 4 ) { Handler(CurDoc) }; };
		};


	} else {

			// Load synchronously
		CurDoc.async = false;

	};

		// Load from the passed URL
	CurDoc.load(URL);

		// Return the document
	return CurDoc;

};


	// DP_AJAX.parseXML Method
	// Accepts a blob of (presumably XML) plain text and attempts to generate an XML document
	//
DP_AJAX.parseXML = function( Text ) {

		// If DOMParser is available, use it
	if ( window.DOMParser ) {

		return new DOMParser().parseFromString(Text, "application/xml");

		// For IE use ActiveX
	} else if ( typeof ActiveXObject != "undefined" ) {

		var CurDoc = DP_AJAX.createXML();
		CurDoc.loadXML(Text);
		return CurDoc;

		// Last ditch effort for Safari (and possibly others)
		// Thanks to Manos Batsis and his Sarissa library (sarissa.sourceforge.net) for this technique.
	} else {

		var URL = "data:text/xml;charset=utf-8," + encodeURIComponent(Text);
		var Request = new XMLHttpRequest();
		Request.open("GET", URL, false);
		Request.send(null);
		return Request.responseXML;
	};

};


	// DP_AJAX.XMLToString Method
	// Attempts to return a plain-text representation of passed XML
	//
DP_AJAX.xmlToString = function( XML ) {

	try {
		return (new XMLSerializer()).serializeToString(XML)
	} catch (e) {
		try {
			return XML.xml
		} catch (e) {
			throw new Error("DP_AJAX.XMLToString() method was unable to find a method to convert the passed XML to a string.");
		};
	};

	return false;

};