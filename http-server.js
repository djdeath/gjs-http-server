// This is a simple example of a HTTP server in Gjs using libsoup

const Lang = imports.lang;

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Soup = imports.gi.Soup;

const ByteArray = imports.byteArray;

/* HTTP handler */

let handlers = {};

let registerHandler = function(path, handler) {
    log('Register handler for ' + path);
    handlers[path] = handler;
};

let findHandler = function(path) {
    let ret = path.replace("//", "/");
    ret = ret.replace("//", "/");
    return handlers[ret];
};

/* Files */

let filesHash = {}
let addFile = function(httpPath, localPath) {
    let f = {
        httpPath: httpPath,
        localPath: localPath,
    };
    filesHash[httpPath] = f;
};

let findFileFromPath = function(path) {
    let p = path.replace("//", "/");
    p = p.replace("//", "/");
    return filesHash[p];
};

/**/

let directories = [];

let addDirectory = function(localPath) {
    directories.push(localPath);
};

let findFileFromPath = function(path) {
    for (let i in directories) {
        let lpath = directories[i] + path;
        if (GLib.file_test(lpath, GLib.FileTest.IS_REGULAR))
            return lpath;
    }
    return null;
};

/* updates.xml generation */

let checksumString = function(str) {
    return GLib.compute_checksum_for_string(GLib.ChecksumType.SHA256, str, str.length);
};

let checksumBytes = function(bytes) {
    return GLib.compute_checksum_for_bytes(GLib.ChecksumType.SHA256, bytes);
};

let compress = function(str) {
    let tmpfile = new Gio.File.new_for_path('/tmp/plop');
    try {
        tmpfile.delete(null);
    } catch (ex) {
        log(ex.message);
    }

    let output = new Gio.ConverterOutputStream({
    base_stream: tmpfile.create(Gio.FileCreateFlags.REPLACE_DESTINATION, null),
        converter: new Gio.ZlibCompressor({
        format: Gio.ZlibCompressorFormat.GZIP,
        }),
    });

    let bytes = GLib.Bytes.new(str, str.length);
    //log('writing ' + bytes.get_size() + 'bytes');
    output.write_bytes(bytes, null);
    output.flush(null);
    output.close(null);

    let input = tmpfile.read(null);
    let infos = tmpfile.query_info('standard::size', 0, null);
    return input.read_bytes(infos.get_size(), null);
};


/* Handling updates payload */

let payloadHandler = function(server, msg, path, query, client) {
    let localPath = findFileFromPath(path);
    if (!localPath) {
        log(path + ' missing?? ');
        msg.status_code = 404;
        return;
    }

    let mime = Gio.content_type_guess(localPath, null)[0];
    let file = Gio.File.new_for_path(localPath);
    let io = file.read(null);

    log('sending ' + localPath + ' mime=' + mime);

    let reader = function(msg) {
        let buffer = io.read_bytes(1024, null);

        if (buffer.get_size() > 0)
            msg.response_body.append(buffer.get_data(), buffer.get_size());
        else
            msg.response_body.complete();
    };

    if (io) {
        msg.status_code = 200;
        msg.response_body.set_accumulate(true);
        msg.response_headers.set_content_type(mime, {});
        msg.response_headers.set_encoding(Soup.Encoding.EOF);

        msg.connect('wrote-headers', Lang.bind(this, reader));
        msg.connect('wrote-chunk', Lang.bind(this, reader));
    } else {
        log(path + ' -> ' + localPath + ' missing???');
        msg.status_code = 404;
        msg.response_body.complete();
    }
};

/* Libsoup handler */

let mainHandler = function(server, msg, path, query, client) {
    payloadHandler(server, msg, path, query, client);
};

/**/

let main = function() {
    /* Add directories to look into */
    for (let i in ARGV)
        addDirectory(ARGV[i]);


    /**/
    let server = new Soup.Server({ port: 1080 });
    server.add_handler(null, mainHandler);
    server.run();
};

log(Gio.content_type_guess('main.txt', null));

main();
