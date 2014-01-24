// This is a simple example of a HTTP server in Gjs using libsoup

const Lang = imports.lang;

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Soup = imports.gi.Soup;

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

main();
