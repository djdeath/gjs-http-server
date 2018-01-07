// This is a simple example of a HTTP server in Gjs using libsoup

const Lang = imports.lang;
const Mainloop = imports.mainloop;

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

let fileMime = function(path) {
  let file = Gio.File.new_for_path(path);
  let io = file.read(null);
  let data = io.read_bytes(100, null);
  let mime = Gio.content_type_guess(path, data.get_data())[0];
  io.close(null);
  return mime;
};

/* Handling updates payload */

let payloadHandler = function(server, msg, path, query, client) {
    let localPath = findFileFromPath(path);
    if (!localPath) {
        log(path + ' missing?? ');
        msg.status_code = 404;
        return;
    }

    let mime = fileMime(localPath);
    let file = Gio.File.new_for_path(localPath);
    let fileInfo = file.query_info('*', Gio.FileQueryInfoFlags.NONE, null);
    let io = file.read(null);

    log('sending ' + localPath + ' mime=' + mime);

    let reader = function(msg) {
        let buffer = io.read_bytes(fileInfo.get_size(), null);
        if (buffer.get_size() > 0)
            msg.response_body.append(buffer.get_data(), buffer.get_size());
        else {
            io.close(null);
            msg.response_body.complete();
        }
    };

    if (io) {
        msg.status_code = 200;
        msg.response_body.set_accumulate(true);
        msg.response_headers.set_content_type(mime, {});
        msg.response_headers.set_content_length(fileInfo.get_size());
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
    if (path == '/')
        path = '/index.html';
    payloadHandler(server, msg, path, query, client);
};

/**/

let main = function() {
    /* Add directories to look into */
    for (let i in ARGV)
        addDirectory(ARGV[i]);

    /**/
    let server =
        new Soup.Server({ tls_certificate: Gio.TlsCertificate.new_from_files('test-cert.pem',
                                                                             'test-key.pem') });

    server.add_handler(null, mainHandler);
    server.listen_all(1080, GLib.getenv('HTTPS') ? Soup.ServerListenOptions.HTTPS : 0);
    log(server.is_https());

    Mainloop.run('gjs-http-server');
};

main();
