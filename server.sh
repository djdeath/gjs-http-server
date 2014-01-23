#!/bin/sh

export GJS_DEBUG_TOPICS="JS ERROR;JS LOG"
export GJS_PATH=$PWD

gjs http-server.js $@
