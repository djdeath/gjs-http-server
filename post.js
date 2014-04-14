// This is a simple example of a HTTP server in Gjs using libsoup

const Lang = imports.lang;

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Soup = imports.gi.Soup;
const Mainloop = imports.mainloop;

/**/

if (ARGV.length < 2) {
    throw 'format: post.js http://url.com/path file.txt';
}

/**/

let url = ARGV[0];
let filePath = ARGV[1];
let file = Gio.File.new_for_path(filePath);

/**/

let session = new Soup.Session();

let multipart = Soup.Multipart.new('multipart/form-data');

let attachFile = function(part, file) {
    let mime = Gio.content_type_guess(file.get_path(), null)[0];
    let size = file.query_info('*',
                               Gio.FileQueryInfoFlags.NONE,
                               null).get_size();
    let io = file.read(null);
    let buffer = io.read_bytes(size, null);

    log('attaching file=' + file.get_basename() + ' mime=' + mime);
    part.append_form_file(file.get_basename(),
                          file.get_basename(),
                          mime,
                          Soup.Buffer.new(buffer.get_data(),
                                          buffer.get_size()));
};


attachFile(multipart, file);

/**/

let msg = Soup.Message.new("POST", url);
msg.connect('finished', Lang.bind(this, function() {
    log('finished!');
}));
msg.connect('wrote-body', Lang.bind(this, function() {
    log('wrote-body!');
}));

multipart.to_message(msg.request_headers, msg.request_body);
msg.request_body.complete();
log(msg.request_body.length);
session.send_message(msg);
