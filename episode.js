const request = require('request'),
    decode = require('unescape'),
    path = require('path'),
    fs = require('fs'),
    config = require('./config.json'),
    mediaUrls = [];

function downloadIndexUrl(indexUrl, metadataFile, fileName, callback) {
    var spawn = require('child_process').spawn,
        ffmpeg = spawn(config.ffmpegPath, ['-i', indexUrl, '-i', metadataFile, '-map_chapters', '1', '-c', 'copy', fileName + '.mp4']);
    ffmpeg.stdout.on('data', function (data) {
        console.log('stdout: ' + data.toString());
    });

    ffmpeg.stderr.on('data', function (data) {
        console.log('stderr: ' + data.toString());
    });

    ffmpeg.on('exit', function (code) {
        console.log('child process exited with code ' + code.toString());
        fs.unlinkSync(metadataFile);
        callback();
    });
}

function downloadMedias(mediaUrls, index, callback) {
    if (index >= mediaUrls.length) {
        return callback();
    }
    downloadIndexUrl(mediaUrls[index].url, mediaUrls[index].metadataFile, mediaUrls[index].fileName, function () {
        downloadMedias(mediaUrls, index + 1, callback);
    });
}

function searchUrls(driver, urls, index, callback) {
    if (index >= urls.length) {
        return callback();
    }
    driver.get(urls[index]);

    driver.getPageSource().then(function (pageSource) {

        var vilosConfig = /(vilos.config.media\s*=\s*)+(\{.*\};)/g.exec(pageSource),
            season = /"season:([^"]*)/g.exec(pageSource),
            url_parts = urls[index].split('/');
        vilosConfig = vilosConfig[2];
        vilosConfig = JSON.parse(vilosConfig.substring(0, vilosConfig.length - 1));

        var masterIndexUrl,
            dirName = path.join(config.outdir, url_parts[url_parts.length - 2]);
        if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName);
        }
        if (season && season.length) {
            dirName = path.join(dirName, season[1].trim());
        }
        if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName);
        }
        var fileName = path.join(dirName, url_parts[url_parts.length - 1]).toString();

		for (var stream in vilosConfig.streams) {
			stream = vilosConfig.streams[stream];
			if (stream.hardsub_lang === config.preferedLang && config.ignoreStreamFormat.indexOf(stream.format) < 0) {
				console.log(stream);
				masterIndexUrl = decode(decodeURIComponent(stream.url));
				break;
			}
		}
        request.get(masterIndexUrl, {}, function (err, response) {
            if (err) {
                throw err;
            } else {
                var lines = response.body.split('\n'),
                    i,
                    resolutionStr,
                    resolution,
                    curResolution,
                    indexUrl,
                    metadataFile = 'temp/' + vilosConfig.metadata.id + '.metadata',
                    metadataContent = [],
                    adChapterOffset = parseInt(config.adChapterOffset || "20000");
                for (i = 0; i < lines.length; i += 1) {
                    if (lines[i] && lines[i].trim()) {
                        resolutionStr = /(RESOLUTION=)([0-9]+)/g.exec(lines[i]);
                        if (resolutionStr) {
                            resolution = parseInt(resolutionStr[2]);
                            if (!curResolution || resolution > curResolution) {
                                curResolution = resolution;
                                indexUrl = lines[i + 1];
                            }
                        }
                    }
                }
                metadataContent.push(";FFMETADATA1\ntitle=");
                metadataContent.push(vilosConfig.metadata.title);
                metadataContent.push("\n")
                for (i = 0; i < vilosConfig.ad_breaks.length; i++) {
                    var ad_break = parseInt(vilosConfig.ad_breaks[i].offset) - adChapterOffset,
                        next_ad_break = vilosConfig.ad_breaks[i + 1];
                    if (ad_break < 0) {
                        ad_break = 0;
                    }
                    if (next_ad_break) {
                        next_ad_break = parseInt(next_ad_break.offset) - (adChapterOffset + 1);
                    } else {
                        next_ad_break = parseInt(vilosConfig.metadata.duration);
                    }

                    metadataContent.push("[CHAPTER]\nTIMEBASE=1/1000\nSTART=");
                    metadataContent.push(ad_break);
                    metadataContent.push("\nEND=");
                    metadataContent.push(next_ad_break);
                    metadataContent.push("\n");
                }
                metadataContent.push("[STREAM]\ntitle=");
                metadataContent.push(vilosConfig.metadata.title);
                fs.writeFileSync(metadataFile, metadataContent.join(''));

                mediaUrls.push({url: indexUrl, metadataFile: metadataFile, fileName: fileName});
                searchUrls(driver, urls, index + 1, callback);
            }
        });
    });
}

module.exports = {
    searchUrls: function (driver, urls, driverCallback, callback) {
		try {
			fs.mkdirSync('temp');
		} catch (e) {

		}
        searchUrls(driver, urls, 0, function () {
            if (driverCallback) {
                driverCallback();
            }
            console.log(mediaUrls);
            downloadMedias(mediaUrls, 0, callback);
        });
    }
}
