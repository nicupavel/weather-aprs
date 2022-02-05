module.exports = (function () {
    "use strict";

    const Ftp = require('basic-ftp');
    const MetarParser = require('aewx-metar-parser');
    const { Writable } = require('stream');

    const metarStream = new Writable({
        write(chunk, encoding, callback) {
            console.log(chunk.toString());
            callback();
        }
    });

    const metarHost = 'tgftp.nws.noaa.gov';
    const metarPath = '/data/observations/metar/stations';

    async function download() {
        const client = new Ftp.Client()
        client.ftp.verbose = false;
        try {
            const nowTs = new Date().getTime() / 1000;
            const nowYear = new Date().getFullYear();

            await client.access({
                host: metarHost,
            })
            let metarFiles = await client.list(metarPath);

            metarFiles = metarFiles.filter((file) => {
                let includesTime = file.rawModifiedAt?.includes(':');
                let dateInfo = file.rawModifiedAt?.split(' ');

                // NOAA FTP doesn't list year when file date is in current year
                if (dateInfo.length == 3 && includesTime) {
                    file.rawModifiedAt = `${dateInfo[0]} ${dateInfo[1]} ${nowYear} ${dateInfo[2]}`
                    //console.log(`${file.rawModifiedAt}`);

                }
                let fileTs = new Date(file.rawModifiedAt)?.getTime() / 1000;
                return (file.isFile
                    && file.name !== '.listing'
                    && fileTs
                    && (nowTs - fileTs < 3600 * 8)
                )
            })

            for (const file of metarFiles) {
                try {
                    console.log(`Downloading: ${file.name}`);
                    let metarRawData = [];
                    const metarStream = new Writable({
                        write(chunk, encoding, callback) {
                            metarRawData.push(chunk.toString());
                            callback();
                        }
                    });
                    metarStream.on('finish', () => {
                        const metarData = metarRawData.join().trim().split('\n');
                        if (metarData.length == 2) {
                            const metarObject = MetarParser(metarData[1])
                            console.log(metarObject);
                        }
                    })

                    await client.downloadTo(metarStream, `${metarPath}/${file.name}`);
                    metarStream.destroy();
                } catch (err) {
                    console.log(`Failed to download ${file.name}`);
                }

            }
        }
        catch (err) {
            console.log(err);
        }
        client.close();
    }

    return {
        download: download
    }
})()

const Metar = require('./metar.js')
Metar.download()