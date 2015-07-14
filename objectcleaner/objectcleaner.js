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
						
					// Case 2: both are objects - recursion eventually needed
					//         An object could be an Array - 2 different use cases
					// TODO: Fix this!	
					} else if (((typeof tProp) === "object") && ((typeof cProp) === "object")) {
						
						if (Array.isArray(tProp) && Array.isArray(cProp))  {
							// Case 3a : Strict data type testing required
							if (node.strictclean) {
								cleandit = node.arrayCompare(tProp, cProp, logobject, (hasBeenCleaned || cleandit));
							}
							// Case 3b : we just leave them
						} else {
							// Deep cleaning ob objects
							cleandit = node.deepclean(tProp, cProp, logobject, (hasBeenCleaned || cleandit));
							candidate[prop] = cProp;
						}
					}
				
				// Case 4: property is not there	
				} else {
					delete candidate[prop];
					logobject.messages.push({"notInTemplate" : prop});
					cleandit = true;
				}
			}
			
			return (hasBeenCleaned || cleandit);			
		};
		
		// Compares 2 arrays, so the second only has objects of the same type as the first
		this.arrayCompare = function(tArray, cArray, logobject, hasBeenCleaned) {
			// Check available datatypes in template
			var cleandit = false;
			var objTypes = {};
			var curType = "";
			for(var i in tArray) {
				curType = (typeof tArray[i]);
				objTypes[curType] = true;				
			}
			// Check the candidate array for the same data types
			for (var j in cArray) {
				curType = (typeof cArray[j]);
				if (curType==="object" && objTypes["object"]) {
					// TODO: Deep comparison neededed - first arrays
					
				} else if  (!objTypes[curType]) {
					cleandit = true;
					logobject.messages.push({"arrayremove" : curType});
					delete cArray[j];
				}
				
			}
			
			return (hasBeenCleaned || cleandit);
		};
		
		/* Checks that the candate has each property the template has too */
		/* Does deep inspection, so we get a good log object */
		this.hasAllProperties = function(template, candidate, logobject, addIfMissing) {
				var result = true;
				var addedProps = false;
				for (var prop in template) {
					if (!candidate.hasOwnProperty(prop)) {
						if (addIfMissing) {
							candidate[prop] = template[prop];
							logobject.messages.push({"added" : prop});
							addedProps = true;
						} else {
							logobject.messages.push({"missing" : prop});
							result = false;
						}					
					} else {
						var tProp = template[prop];
						var cProp = candidate[prop];
						
						// Case 1: strict checking and types
						if (node.strictclean && ((typeof tProp) !== (typeof cProp))) {
							logobject.messages.push({"wrongDataType" : prop});
							result = false;
						
						// Case 2: both objects, deep inspection needed
						} else if (((typeof tProp) === "object") && ((typeof cProp) === "object")) {
							var subresult = node.hasAllProperties(tProp, cProp, logobject, addIfMissing);
							// Stop at the first failure
							if (!subresult) {
								result = false;
							}
						}
					}
				}
				logobject.propertiesAdded = addedProps;				
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
						
						var goodToGo = node.hasAllProperties(node.template, candidate, logobject, (node.musthaveallproperties==="1"));
						
						if ((node.musthaveallproperties==="0") || goodToGo) {
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
