A simple web crawler for crunchyroll

# Getting started

Install [Node.js](https://nodejs.org/)

Download [ffmpeg](https://www.ffmpeg.org/download.html)

Configure paths in config.json

## Download Episode

Execute with:
```sh
node index.js <episode url>
```

Example:
```sh
node index.js https://www.crunchyroll.com/hunter-x-hunter/episode-1-departure-x-and-x-friends-584886
```

## Download Series

Download/Update Series, listing local downloaded episodes and comparing with the series listing

Execute with:
```sh
node series.js <series url>
```

Example:
```sh
node series.js https://www.crunchyroll.com/hunter-x-hunter
```