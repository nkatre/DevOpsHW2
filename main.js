var esprima = require("esprima");
var options = {tokens : true, tolerant: true, loc: true, range: true };
var faker = require("faker");
var fs = require("fs");
faker.locale = "en";
var mock = require('mock-fs');
var _ = require('underscore');

function main()
{
	var args = process.argv.slice(2); // selects all the elements from index position 2
/*
var arguments = process.argv.slice(2);
Note that the first arg is usually the path to nodejs, and the second arg is the location of the script you're executing.
*/
	if( args.length == 0 )
	{
		args = ["subject.js"];
	}
	var filePath = args[0];

	constraints(filePath);

	generateTestCases();
}


function fakeDemo()
{
	console.log( faker.phone.phoneNumber() );
	console.log( faker.phone.phoneNumberFormat() );
	console.log( faker.phone.phoneFormats() );
}

var functionConstraints =
{
}

var mockFileLibrary = 
{
	pathExists:
	{
		'path/fileExists': {}
	},
	fileWithContent:
	{
		pathContent: 
		{	
  			file1: 'text content',
		}
	},
    emptyFile:                  // attribute where the file is without any content
    {
         pathContent: 
		{	
  			file1: '',
		}  
    }
};

function generateTestCases()
{

	var content = "var subject = require('./subject.js')\nvar mock = require('mock-fs');\n";
	for ( var funcName in functionConstraints )
	{
		var params = {};

		// initialize params
		for (var i =0; i < functionConstraints[funcName].params.length; i++ )
		{
			var paramName = functionConstraints[funcName].params[i];
			//params[paramName] = '\'' + faker.phone.phoneNumber()+'\'';
			params[paramName] = '\'\'';
		}

		//console.log( params );

		// update parameter values based on known constraints.
		var constraints = functionConstraints[funcName].constraints;
        
		// Handle global constraints...
		var fileWithContent = _.some(constraints, {mocking: 'fileWithContent' });  // file with content
		var pathExists      = _.some(constraints, {mocking: 'fileExists' });  // where the path of file exists
        
        var emptyFile = _.some(constraints, {mocking: 'emptyFile' });   // for file where the content is empty
        var varQUndefined = _.some(constraints, {value: 'undefined' });  // variable q = undefined
        var telNumber = _.some(constraints, {value: '212' });     // to handle the area code of tel number
        var truthNormalization = _.some(constraints, {value: true });  // for true
        var liesNormalization = _.some(constraints, {value: false });  // for false
        var varQZeroValue = _.some(constraints, {value: '0' });  // where q=0
        
        
    

		for( var c = 0; c < constraints.length; c++ )
		{
			var constraint = constraints[c];
			if( params.hasOwnProperty( constraint.ident ) )
			{
				params[constraint.ident] = constraint.value;
			}
		}

		// Prepare function arguments.
		var args = Object.keys(params).map( function(k) {return params[k]; }).join(",");
		if( pathExists || fileWithContent )
		{
			content += generateMockFsTestCases(pathExists,fileWithContent,!emptyFile, funcName, args);
			// Bonus...generate constraint variations test cases....
			content += generateMockFsTestCases(!pathExists,fileWithContent,!emptyFile,funcName, args);
			content += generateMockFsTestCases(pathExists,!fileWithContent,!emptyFile,funcName, args);
			content += generateMockFsTestCases(!pathExists,!fileWithContent,!emptyFile,funcName, args);
            content += generateMockFsTestCases(pathExists,!fileWithContent,emptyFile,funcName, args);
        }
        else if(varQUndefined||varQZeroValue){     // condition when q = 0 OR q=undefined
            content += "subject.{0}({1});\n".format(funcName, args );
            content += "subject.{0}({1});\n".format(funcName, "-10,undefined" ); // p= -ve and q=undefined
            content += "subject.{0}({1});\n".format(funcName, "-11,0" );  // p= -ve and q = 0
        }  
        else if(truthNormalization||liesNormalization){   // condition when normalization = true and normalization=false
            var phoneNum = faker.phone.phoneNumberFormat();
            var phoneFormat = faker.phone.phoneFormats();
            var phoneOptions = "{normalize:true}".toString();
            content += "subject.{0}({1});\n".format(funcName, "'"+phoneNum+"','"+phoneFormat+"',"+ phoneOptions );
        }
        else if(!telNumber){
            var phn = faker.phone.phoneNumberFormat();
            content += "subject.{0}({1});\n".format(funcName, "'212-366-5986'" ); 
            content += "subject.{0}({1});\n".format(funcName, "'"+phn+"'" );  
        }
		else
		{
			// Emit simple test case.
			content += "subject.{0}({1});\n".format(funcName, args );
            
		}

	}


	fs.writeFileSync('test.js', content, "utf8");

}

function generateMockFsTestCases (pathExists,fileWithContent,emptyFile,funcName,args) 
{
	var testCase = "";
	// Insert mock data based on constraints.
	var mergedFS = {};
	if( pathExists )
	{
		for (var attrname in mockFileLibrary.pathExists) { mergedFS[attrname] = mockFileLibrary.pathExists[attrname]; }
	}
	if( fileWithContent )
	{
		for (var attrname in mockFileLibrary.fileWithContent) { mergedFS[attrname] = mockFileLibrary.fileWithContent[attrname]; }
	}
    if(emptyFile)
    {
        for (var attrname in mockFileLibrary.emptyFile) { mergedFS[attrname] = mockFileLibrary.emptyFile[attrname]; }
    }


	testCase += 
	"mock(" +
		JSON.stringify(mergedFS)
		+
	");\n";

	testCase += "\tsubject.{0}({1});\n".format(funcName, args );
	testCase+="mock.restore();\n";
	return testCase;
}

function constraints(filePath)
{
   var buf = fs.readFileSync(filePath, "utf8");
	var result = esprima.parse(buf, options);

	traverse(result, function (node) 
	{
		if (node.type === 'FunctionDeclaration') 
		{
			var funcName = functionName(node);
			console.log("Line : {0} Function: {1}".format(node.loc.start.line, funcName ));

			var params = node.params.map(function(p) {return p.name});

			functionConstraints[funcName] = {constraints:[], params: params};

			// Check for expressions using argument.
			traverse(node, function(child)
			{
				if( child.type === 'BinaryExpression' && child.operator == "==")
				{
					if( child.left.type == 'Identifier' && params.indexOf( child.left.name ) > -1)
					{
						// get expression from original source code:
						//var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])
						functionConstraints[funcName].constraints.push( 
							{
								ident: child.left.name,
								value: rightHand
							});
					}
				}
                
                
                if( child.type === 'BinaryExpression' && child.operator == "<")
				{
					if( child.left.type == 'MemberExpression' && params.indexOf( child.left.property.name ) == "length")
					{
						// get expression from original source code:
						//var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])
						functionConstraints[funcName].constraints.push( 
							{
								ident: child.left.object.name,
								value: rightHand
							});
					}
				}
                
                if( child.type === 'BinaryExpression' && child.operator == ">")
				{
					if( child.left.type == 'MemberExpression' && params.indexOf( child.left.name ) == "length")
					{
						// get expression from original source code:
						//var expression = buf.substring(child.range[0], child.range[1]);
						var rightHand = buf.substring(child.right.range[0], child.right.range[1])
						functionConstraints[funcName].constraints.push( 
							{
								ident: child.left.object.name,
								value: rightHand
							});
					}
				}
               
                
              if( child.type == 'LogicalExpression' && child.operator=="||")
				{

					if(child.left.type=='UnaryExpression')
					{
						functionConstraints[funcName].constraints.push(
							{
							ident: child.left.argument.name,
							value: true,
							}
							);
						functionConstraints[funcName].constraints.push(
							{
							ident: child.left.argument.name,
							value: false,
							}
							);
					}

				if(child.right.type=='UnaryExpression' && child.right.operator == "!"){
					if(child.right.argument.type=='MemberExpression'){
					functionConstraints[funcName].constraints.push(
						{
						ident: child.right.argument.object.name+'.'+child.right.argument.property.name,
						value: true,
						}
						);
					
					}
				}
			}
                
				if( child.type == "CallExpression" && 
					 child.callee.property &&
					 child.callee.property.name =="readFileSync" )
				{
					for( var p =0; p < params.length; p++ )
					{
						if( child.arguments[0].name == params[p] )
						{
							functionConstraints[funcName].constraints.push( 
							{
								// A fake path to a file
								ident: params[p],
								value: "'pathContent/file1'",
								mocking: 'fileWithContent'
							});
						}
					}
				}
                
                
                	if( child.type == "CallExpression" && 
					 child.callee.property &&
					 child.callee.property.name =="readFileSync" )
				{
					for( var p =0; p < params.length; p++ )
					{
						if( child.arguments[0].name == params[p] )
						{
							functionConstraints[funcName].constraints.push( 
							{
								// A fake path to a file
                                ident: params[p],
								value: "'pathContent/file1'",
								mocking: 'emptyFile'
							});
						}
					}
				}

				if( child.type == "CallExpression" &&
					 child.callee.property &&
					 child.callee.property.name =="existsSync")
				{
					for( var p =0; p < params.length; p++ )
					{
						if( child.arguments[0].name == params[p] )
						{
							functionConstraints[funcName].constraints.push( 
							{
								// A fake path to a file
								ident: params[p],
								value: "'path/fileExists'",
								mocking: 'fileExists'
							});
						}
					}
				}
                

			});

			console.log( functionConstraints[funcName]);

		}
	});
}

function traverse(object, visitor) 
{
    var key, child;

    visitor.call(null, object);
    for (key in object) {
        if (object.hasOwnProperty(key)) {
            child = object[key];
            if (typeof child === 'object' && child !== null) {
                traverse(child, visitor);
            }
        }
    }
}

function traverseWithCancel(object, visitor)
{
    var key, child;

    if( visitor.call(null, object) )
    {
	    for (key in object) {
	        if (object.hasOwnProperty(key)) {
	            child = object[key];
	            if (typeof child === 'object' && child !== null) {
	                traverseWithCancel(child, visitor);
	            }
	        }
	    }
 	 }
}

function functionName( node )
{
	if( node.id )
	{
		return node.id.name;
	}
	return "";
}


if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

main();