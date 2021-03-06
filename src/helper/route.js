const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const promisify = require('util').promisify;
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);
const config = require('../config/index');
const mime = require('./mime.js');
const compress = require('./compress.js');
const isFresh = require('./cache.js');

const tplPath = path.join(__dirname, '../template/index.tpl');
const source = fs.readFileSync(tplPath);
const template = handlebars.compile(source.toString());

module.exports = async function(req, res, filePath) {
    try {
        const stats = await stat(filePath);
        if(stats.isFile()) {
            const contentType = mime(filePath);
            res.setHeader('ContentType', contentType);
            if(isFresh(stats, req, res)) {
                res.setStatusCode = 304;
                res.end();
                return;
            }

            res.setStatusCode = 200;
            let rs = fs.createReadStream(filePath);
            if(filePath.match(config.compress)) {
                rs = compress(rs, req, res); 
            }
            rs.pipe(res);
        } else if(stats.isDirectory()) {
            const files = await readdir(filePath);
            res.setStatusCode = 200;
            res.setHeader('ContentType', 'text/html');
            const dir = path.relative(config.root, filePath);
            const data = {
                title: path.basename(filePath),
                dir: dir ? `/${dir}` : '',
                files: files.map(file => {
                    return {
                        file,
                        type: mime(file)
                    }
                })
            }
            res.end(template(data));
        }
    } catch(ex) {
        console.error(ex);
        res.setStatusCode = 404;
        res.setHeader('ContentType', 'text/plain');
        res.end(`${filePath} is not a directory or file`);
    }
}