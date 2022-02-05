const Ftp = require('basic-ftp');
const { Writable } = require('stream');

const metarStream = new Writable({
  write(chunk, encoding, callback) {
    console.log(chunk.toString());
    callback();
  }
});



const metarHost = 'tgftp.nws.noaa.gov';
const metarPath = '/data/observations/metar/stations';
downloadMetar()


async function downloadMetar() {
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
                && fileTs
                && file.name !== '.listing'
                && (nowTs - fileTs < 3600 * 8) 
                )
        })

        for (const file of metarFiles) {
            try {
                console.log(`Downloading: ${file.name}`);
                let metarData = [];
                const metarStream = new Writable({
                    write(chunk, encoding, callback) {
                        metarData.push(chunk.toString());                        
                        callback();
                    }
                });
                metarStream.on('finish', () => {
                    console.log(metarData);
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
