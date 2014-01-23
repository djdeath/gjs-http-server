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
    let f = findFileFromPath(path);
    if (!f) {
        msg.status_code = 404;
        return;
    }

    let file = Gio.File.new_for_path(f.localPath);
    let io = file.read(null);

    let reader = function(msg) {
        let buffer = io.read_bytes(1024, null);

        if (buffer.get_size() > 0)
            msg.response_body.append(buffer.get_data(), buffer.get_size());
        else
            msg.response_body.complete();
    };

    if (io) {
        msg.status_code = 200;
        msg.response_headers.set_content_type('text/html', {});
        msg.response_headers.set_encoding(Soup.Encoding.CHUNKED);

        msg.connect('wrote-headers', Lang.bind(this, reader));
        msg.connect('wrote-chunk', Lang.bind(this, reader));
    } else {
        msg.status_code = 404;
        msg.response_body.complete();
    }
};

let installFilesHandler = function(server) {
    for (let i in filesHash) {
        let f = filesHash[i];
        registerHandler(f.httpPath, payloadHandler);
    }
};

/* Libsoup handler */

let mainHandler = function(server, msg, path, query, client) {
    log("Looking for handler " + path);
    let handler = findHandler(path);

    if (handler)
        handler(server, msg, path, query, client);
};

/**/

let main = function() {

    /* Add files */
    for (let i in ARGV) {
        let dir = Gio.File.new_for_path(ARGV[i]);
        let enumerator = dir.enumerate_children("",
                                                Gio.FileQueryInfoFlags.NONE,
                                                null);
        let info = null;
        while ((info = enumerator.next_file(null))) {
            let name = info.get_name();
            let path = dir.get_path() + '/' + name;
            log(path);
            addFile('/' + name, path);
        }

    }

    /**/
    let server = new Soup.Server({ port: 1080 });
    server.add_handler('/', mainHandler);
    installFilesHandler(server);

    server.run();
}

main();
