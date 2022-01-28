FROM node:12
WORKDIR /weather-aprs
COPY ../../ ./
RUN npm install forever -g && \
    npm install
CMD ["forever", "/rainmachine-proxy-front/bin/www"]
