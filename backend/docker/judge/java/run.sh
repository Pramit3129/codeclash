#!/bin/sh

mkdir -p /tmp/java

javac \
  -d /tmp/java \
  /sandbox/Main.java

if [ $? -ne 0 ]; then
    exit 1
fi

exec java \
  -cp /tmp/java \
  Main
