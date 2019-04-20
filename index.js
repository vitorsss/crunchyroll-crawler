require('chromedriver');
const args = process.argv.slice(2),
    chrome = require('selenium-webdriver/chrome'),
    {Builder, until} = require('selenium-webdriver'),
    driver = new Builder().forBrowser('chrome').setChromeOptions(new chrome.Options().headless().windowSize({width: 640, height: 480})).build(),
    episodeSearch = require('./episode.js');


driver.get('https://www.crunchyroll.com/');
driver.wait(until.titleContains('Crunchyroll'), 20000).then(function () {
    episodeSearch.searchUrls(driver, args, function () {
        driver.close().then(function () {
            driver.quit();
        });
    }, function () {
        console.log('download end');
    });
});
