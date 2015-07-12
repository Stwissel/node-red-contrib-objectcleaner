/**
 * Copyright 2015 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
    "use strict";

    // Recurseively cleans properties from the candidate that
    // don't exist in the template
    // When strictclean is set, then the data types are compared
    // and cleaned if mismatching
    function ObjectCleaner(n) {
        // Create a RED node
        RED.nodes.createNode(this,n);
        var node = this;
        node.name = n.name;
        node.field = n.field || "payload";
        node.template = JSON.parse(n.template);
        node.strictclean = n.strictclean;
        node.notempty = n.notempty;
        node.musthaveallproperties = n.musthaveallproperties;
        
        this.deepclean = function(template, candidate, logobject, hasBeenCleaned) {
			var cleandit = false;
			
			for (var prop in candidate) {
				
				if (template.hasOwnProperty(prop)) {
					// We need to check strict clean and recursion
					var tProp = template[prop];
					var cProp = candidate[prop];
					
					// Case 1: strict checking and types are different
					if (node.strictclean && ((typeof tProp) !== (typeof cProp))) {
						delete candidate[prop];
						logobject.messages.push({"wrongDataType" : prop});
						cleandit = true;
						
					// Case 2: both are objects - recursion needed	
					} else if (((typeof tProp) === "object") && ((typeof cProp) === "object")) {
						cleandit = node.deepclean(tProp, cProp, logobject, (hasBeenCleaned || cleandit));
						candidate[prop] = cProp;
					}
				
				// Case 3: property is not there	
				} else {
					delete candidate[prop];
					logobject.messages.push({"notInTemplate" : prop});
					cleandit = true;
				}
			}
			
			return (hasBeenCleaned || cleandit);			
		};
		
		/* Checks that the candate has each property the template has too */
		/* Does deep inspection, so we get a good log object */
		this.hasAllProperties = function(template, candidate, logobject) {
				var result = true;
				for (var prop in template) {
					if (!candidate.hasOwnProperty(prop)) {
						logobject.messages.push({"missing" : prop});
						result = false;
					} else {
						var tProp = template[prop];
						var cProp = candidate[prop];
						
						// Case 1: strict checking and types
						if (node.strictclean && ((typeof tProp) !== (typeof cProp))) {
							logobject.messages.push({"wrongDataType" : prop});
							result = false;
						
						// Case 2: both objects, deep inspection needed
						} else if (((typeof tProp) === "object") && ((typeof cProp) === "object")) {
							var subresult = node.hasAllProperties(tProp, cProp, logobject);
							// Stop at the first failure
							if (!subresult) {
								result = false;
							}
						}
					}
				}
									
				return result; 
			}
        
        // Clean the payload object
        this.on('input', function (msg) {
			var raw = msg[node.field] || {};
			var logobject = {};
			logobject.messages = [];
			
			try {
				// Turn an eventual String into a JSOn object
				var candidate = ((typeof raw) === "string") ? JSON.parse(raw) : raw;
			
				if ((typeof candidate) === "object") {
					
					// Check for empty object - interestingly === {} doesn't work
					if (node.notempty && JSON.stringify(candidate) === "{}") {
						node.error(node.field+" was empty");
						logobject.messages.push({"empty" : node.field});
						node.send([null, logobject]);
					} else {
						// Perform the regular cleanup
						var cleanupNeeded = node.deepclean(node.template, candidate, logobject, false);
						
						// If property matching is required we check here before we send back
						
						var goodToGo = (!node.musthaveallproperties) || node.hasAllProperties(node.template, candidate, logobject);
						
						if (goodToGo) {
							msg[node.field] = candidate;
							// Update the node status and log
							if (cleanupNeeded) {
								logobject.cameInclean = false;
								this.status({fill:"green",shape:"ring",text: node.field+" cleaned"});
								node.log(node.field+" cleaned");
							} else {
								logobject.cameInclean = true;
								this.status({fill:"green",shape:"dot",text: node.field+" is clean"});
							}	
							
							// Finally return it
							node.send([msg, logobject]);
													
						} else {
							var propFail = node.field+" is missing properties";
							this.status({fill:"red",shape:"ring",text: propFail});
							node.error(propFail);
							node.send([null, logobject]);
						}
					}				
					
				} else {
					this.status({fill:"red",shape:"ring",text: node.field+" is not JSON"});
				}
			
            } catch(err) {
				this.status({fill:"red",shape:"dot",text: node.field+" cleanup failed"});
                node.error(err.message);
            }
            
        });

        this.on("close", function() {
            // No action so far
        });
    }

    RED.nodes.registerType("objectcleaner",ObjectCleaner);

}
