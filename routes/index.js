var express = require('express');
var router = express.Router();
var	fs = require('fs');
var formidable = require("formidable");

var parse = require('csv-parse');
var async = require('async');
var moment = require('moment');		
var xml2js = require('xml2js');
var archiver = require('archiver');

const util = require('util');


/* GET home page. */
router.get('/', function(req, res, next) {
	res.render('index', { title: 'Example Read CSV file', message:'', message_error:'' });
});

/* UPLOAD CSV AND processing It */
router.post('/generate', function(req, res, next){
	console.log('Parse CSV file: ');
	var temp_dir = process.cwd() + '/Temp';
	var is_empty = true;
	
	var form = new formidable.IncomingForm();
	form.uploadDir = temp_dir         //set upload directory
	form.keepExtensions = true; 
	console.log('DIR: '+form.uploadDir);

	form.on('error', function(err) {
		console.log('An error has occured: \n' + err);    
	})
    form.on('file', function(field, file) {
        //On file received
		console.log('CSV fle recieved: '+file.name);
        var temp_path = this.openedFiles[0].path;
        var file_name = this.openedFiles[0].name;
		fs.rename(temp_path , form.uploadDir+'/'+file.name, function(err) {
			if (err)
			{
				console.log("Error while renamed  uploaded file!");
				res.status(500).json({ error_message: "Error while renamed  uploaded file, please try again" })				
			}
			else
			{
				console.log("Start processig CSV:");
/*				
NB!				Also possible manualy read CSV file, and parsing, line by line

				var i = 0;
				var inputFile = form.uploadDir+'/'+file.name;
				var parser = parse({delimiter: ','}, function (err, data) {
					async.eachSeries(data, function (line, callback) {
						i++;
						console.log("Line"+i+":"+line);
						callback();
					})
				})
				fs.createReadStream(inputFile).pipe(parser);				
*/

/*				We will use CSVTOJSON library to parse CSV file */

				var Converter = require("csvtojson").Converter;
				var csvFileName=form.uploadDir+'/'+file.name;;
				var csvConverter=new Converter({});

				fs.createReadStream(csvFileName).pipe(csvConverter);
				
				csvConverter.on("end_parsed",function(jsonObj){

/*				Parser finished, now we will modify time to UTC and remove empty lines from CSV */

					Object.keys(jsonObj).forEach(function(key) {
						var val = jsonObj[key];
						is_empty = true;

						Object.keys(val).forEach(function(key1) {
							if (val[key1] !== '') {
								is_empty = false;
							}
						});					
						if (is_empty) {
							delete jsonObj[key];
						}
						else {
							val["utc_time"] = moment(moment(val["time"],"DD/MM/YYYY HH:mm").utc()).format('DD/MM/YYYY HH:mm');
						}
					});					
/*				Additional processing completed  */
								
				
/*				Save JSON to file  */
					var json = JSON.stringify(jsonObj);	
					fs.writeFile(temp_dir+'/json_from_csv_file.json', json, 'utf-8', function(err) {
						if (err) throw err
						else
						{
							console.log('File JSON saved!')
/*				Build and save XML to file  */
							var builder = new xml2js.Builder();
							var xml = builder.buildObject(jsonObj);
							fs.writeFile(temp_dir+'/XML_from_csv_file.xml', xml, 'utf-8', function(err) {
								if (err) throw err
								else
								{
									console.log('File XML saved!')

/*				Create a file to stream archive data to  */
					
									var output = fs.createWriteStream(temp_dir+'/result.zip');
									var archive = archiver('zip', {
										zlib: { level: 9 } // Sets the compression level.
									});

// good practice to catch this error explicitly 
									archive.on('error', function(err) {
										throw err;
									});
 
// pipe archive data to the file 
									archive.pipe(output);
 
// append a file 
									archive.file(temp_dir+'/json_from_csv_file.json', { name: 'json_from_csv_file.json' });
									archive.file(temp_dir+'/XML_from_csv_file.xml', { name: 'XML_from_csv_file.xml' });
 
// finalize the archive (ie we are done appending files but streams have to finish yet) 
									archive.finalize();					
									
/* listen for all archive data to be written */
									output.on('close', function() {
										console.log(archive.pointer() + ' total bytes in ZIP');
  
										res.setHeader('Content-disposition', 'attachment; filename=result.zip');
										res.setHeader('Content-type', "application/octet-stream");  
										res.download(temp_dir+'/result.zip', function(err){
											if (err) {
												console.log('Errror while file downloaded!');
											} else {
												console.log('File ZIP downloaded!');
											}
										});
									});
								}
							})		
						}
					})		
				});
 
			}

			
		})
    })
    form.on('end', function() {
		console.log('Form from request ended!');
    });

    form.parse(req, function(err, fields, files) {
//		console.log("files: "+util.inspect(files, false, null))
//		console.log("fields: "+util.inspect(fields, false, null))
    });
	
});
	

module.exports = router;
