FROM python:3.12-slim

RUN useradd \
    --uid 1000 \
    --create-home \
    --shell /usr/sbin/nologin \
    runner \
    && mkdir -p /sandbox \
    && chown runner:runner /sandbox

COPY docker/judge/python/run.sh /usr/local/bin/run.sh

RUN chmod 755 /usr/local/bin/run.sh

USER runner

WORKDIR /sandbox

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

ENTRYPOINT ["/usr/local/bin/run.sh"]