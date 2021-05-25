![Travis build status](https://travis-ci.org/Stwissel/node-red-contrib-objectcleaner.svg?branch=master)

# node-red-contrib-objectcleaner
Manipulate an object (usually payload) to only have the properties of a sample object provided

## v0.0.4

- Added reference property field to allow user set the reference externally

## v0.0.3

- Fixed JS/HTML name

## v0.0.2

- Added the option to backfill missing properties from the template object
- First capability to handle arrays
- reports what properties were missing or added

Limitation:

- Objects in arrays are not handled deeply, only data type is compared

## v0.0.1

Initial release. Compares 2 JSON objects. Removes properties not found in the template object.

Options:

- strict data type checking: "42" !== 42
- reject objects with missing properties
 
Limitation:

- Can't handle any arrays

