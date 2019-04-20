require('chromedriver');
const args = process.argv.slice(2),
    path = require('path'),
    fs = require('fs'),
    config = require('./config.json'),
    chrome = require('selenium-webdriver/chrome'),
    {Builder, until, By, promise} = require('selenium-webdriver'),
    driver = new Builder().forBrowser('chrome').setChromeOptions(new chrome.Options().headless().windowSize({width: 640, height: 480})).build(),
    episodeSearch = require('./episode.js'),
    seriesEpisodes = {},
    episodesToDownload = [];

function findRecursiveEpisodes(episodes, actualPath) {
    fs.readdirSync(actualPath).forEach(function (file) {
        var stats = fs.lstatSync(path.join(actualPath, file));
        if (stats.isDirectory()) {
            findRecursiveEpisodes(episodes, path.join(actualPath, file));
        } else {
            episodes.push(path.parse(file).name);
        }
    });
}

fs.readdirSync(config.outdir).forEach(function (seriesName) {
    var series = {name: seriesName, url: 'https://www.crunchyroll.com/' + series, episodes: []};
    seriesEpisodes[seriesName] = series;
    findRecursiveEpisodes(series.episodes, path.join(config.outdir, seriesName));
});


function searchSeriesUrl(urls, index, callback) {
    if (index >= urls.length) {
        return callback();
    }
    driver.get(urls[index]);
    driver.findElements(By.css("li.season")).then(function (seasonElements) {
        promise.map(seasonElements, e => e.findElement(By.css("a.season-dropdown"))).then(function (seasonDropDownElements) {
            promise.map(seasonDropDownElements, e => e.getAttribute('title')).then(function (seasonTitles) {
                var seasonElementsToLoad = [];
                seasonTitles.forEach(function (seasonTitle, index) {
                    if (seasonTitle.indexOf('(') < 0 && seasonTitle.indexOf(')') < 0) { //prevent dub seasons
                        seasonElementsToLoad.push(seasonElements[index]);
                    }
                });
                promise.map(seasonElementsToLoad, e => e.findElements(By.css("a.episode"))).then(function (episodeElementsOfSeasons) {
                    var allEpisodeElements = [];
                    episodeElementsOfSeasons.forEach(function (episodeElements) {
                        allEpisodeElements = allEpisodeElements.concat(episodeElements);
                    });
                    promise.map(allEpisodeElements, e => e.getAttribute('href')).then(function (hrefs) {
                        var url_parts = hrefs[0].split('/'),
                            currSeriesEpisodes = seriesEpisodes[url_parts[url_parts.length - 2]];
                        hrefs.forEach(function (href) {
                            url_parts = href.split('/')
                            if (!currSeriesEpisodes || currSeriesEpisodes.episodes.indexOf(url_parts[url_parts.length - 1]) < 0) {
                                episodesToDownload.push(href);
                            }
                        });
                        searchSeriesUrl(urls, index + 1, callback);
                    });
                });
            });
        });
    });
}

driver.get('https://www.crunchyroll.com/');
driver.wait(until.titleContains('Crunchyroll'), 20000).then(function () {
    searchSeriesUrl(args, 0, function () {
        episodeSearch.searchUrls(driver, episodesToDownload, function () {
            driver.close().then(function () {
                driver.quit();
            });
        }, function () {
            console.log('download end');
        });
    });
});

