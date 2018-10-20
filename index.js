var request = require('request'),
    args = process.argv.slice(2),
    path = require('path'),
    fs = require('fs'),
    config = require('./config.json');

function downloadIndexUrl(indexUrl, fileName) {
    var spawn = require('child_process').spawn,
        ffmpeg = spawn(config.ffmpegPath, ['-i', indexUrl, '-c', 'copy', fileName + '.mp4']);
    ffmpeg.stdout.on('data', function (data) {
        console.log('stdout: ' + data.toString());
    });

    ffmpeg.stderr.on('data', function (data) {
        console.log('stderr: ' + data.toString());
    });

    ffmpeg.on('exit', function (code) {
        console.log('child process exited with code ' + code.toString());
    });
}

request.get(args[0], {}, function (err, response) {
    if (err) {
        throw err;
    } else {
        var vilosConfig = /(vilos.config.media\s*=\s*)+(\{.*\};)/g.exec(response.body),
            url_parts = args[0].split('/');
        vilosConfig = vilosConfig[2];
        vilosConfig = JSON.parse(vilosConfig.substring(0, vilosConfig.length - 1));

        var masterIndexUrl,
            dirName = path.join(config.outdir, url_parts[url_parts.length - 2]),
            fileName = path.join(dirName, url_parts[url_parts.length - 1]);

        if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName);
        }

        vilosConfig.streams.forEach(function (stream) {
            if (stream.hardsub_lang === config.preferedLang) {
                masterIndexUrl = stream.url;
            }
        });
        if (masterIndexUrl.indexOf('index.m3u8') > 0) {
            downloadIndexUrl(masterIndexUrl, fileName);
        } else {
            request.get(masterIndexUrl, {}, function (err, response) {
                if (err) {
                    throw err;
                } else {
                    var lines = response.body.split('\n'),
                        i,
                        resolution,
                        curResolution,
                        indexUrl;
                    for (i = 1; i < lines.length; i += 2) {
                        if (lines[i] && lines[i].trim()) {
                            resolution = parseInt(/(RESOLUTION=)([0-9]+)/g.exec(lines[i])[2]);
                            if (!curResolution || resolution > curResolution) {
                                curResolution = resolution;
                                indexUrl = lines[i + 1];
                            }
                        }
                    }
                    downloadIndexUrl(indexUrl, fileName);
                }
            });
        }
    }
});
