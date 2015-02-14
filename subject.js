var fs = require("fs");

function inc(p, q){
    if(q ==undefined) q =1;  // c1     // pass the second value as undefined

   if( p < 0 )  // c2                 // pass the first value less than 0
   {
   	p = -p;  //c3                     
   }

    return p + q/q;
}


function fileTest(dir, filePath)
{
	if (!fs.existsSync(dir)){  // existsSync checks whether a file exists in the node.js directory
   	return false;
	}

   if( fs.existsSync(filePath ))
   {
		var buf = fs.readFileSync(filePath, "utf8");  // readFileSync reads from the file
		if( buf.length > 0 )  //c4                    // give a valid filePath while calling this function such that the file has some contents
		{
			return true;
		}
		return false;   //c5                     // give a valid file path such that the file is empty (i.e. has no contents)
	}
}

function normalize(phoneNumber) {

    return phoneNumber.replace(
      /^[\+\d{1,3}\-\s]*\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/,
      "$1$2$3"
    );

}   

function format(phoneNumber, formatString, options) 
{
    // Normalize the phone number first unless not asked to do so in the options
    if (!options || !options.normalize) {   //c6
      phoneNumber = normalize(phoneNumber)
    };

    for ( var i = 0, l = phoneNumber.length; i < l; i++ ) {  // c7
      formatString = formatString.replace("N", phoneNumber[i]);  // c8
    }
  
    return formatString;

}

function blackListNumber(phoneNumber)
{
	var num = format(phoneNumber, "(NNN) NNN-NNNN");
	var area = num.substring(1,4);                        // get the area code
	if( area == "212" )   //c9                            // enter a number such that the area code is "212"
	{
		return true;  // c10

	}
	return false;
}

exports.fileTest = fileTest;
exports.normalize = normalize;
exports.format = format;
exports.inc = inc;
exports.blackListNumber = blackListNumber;
/*
Exports is used to make parts of your module available to scripts outside the module. So when someone uses require like below in another script:
var sys = require("sys");  
They can access any functions or properties you put in module.exports

Here we have var fs = require("fs");
hence the fs properties such as fileTest, normalize, format, inc and blackListNumber are available to fs module

*/
