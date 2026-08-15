#!/bin/sh

g++ \
  -std=c++20 \
  -O2 \
  /sandbox/main.cpp \
  -o /tmp/main

if [ $? -ne 0 ]; then
    exit 1
fi

exec /tmp/main
