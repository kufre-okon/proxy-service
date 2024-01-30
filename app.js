require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const isDevEnvironment = process.env.NODE_ENV === 'development';

const axios = require("axios");
const cors = require('cors');
const requestIp = require('request-ip');

const app = express();

app.use(logger(isDevEnvironment ? 'dev' : 'prod'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(cors())

app.use('/proxy-service', async function (req, res) {

  try {
    const [status, response] = await proxyService(req);
    res.status(status).json(response);
  } catch (e) {
    return e;
  }
})

async function proxyService(req) {

  const serviceBaseURL = process.env.F4B_APP_BASE_URL || 'https://api-dashboard.flutterwave.com';

  try {
    const forwardPath = req?.path;
    const upstreamRequestURL = `${serviceBaseURL}${forwardPath}`;
    const clientIp = requestIp.getClientIp(req);
    req.headers['x-client-ip'] = clientIp;

    const refinedHeader = req.headers;
    delete refinedHeader.host;
    delete refinedHeader['content-length'];

    const { data, status, statusText } = await axios({
      method: req.method.toLowerCase(),
      headers: refinedHeader,
      url: upstreamRequestURL,
      data: { ...req?.body },
      params: req?.query,
    });

    refinedHeader.authorization = String(refinedHeader.authorization).substring(0, 20);
    const logObject = {
      basePath: serviceBaseURL,
      query: req?.query,
      body: req?.body,
      params: forwardPath,
      header: refinedHeader,
      response_message: data?.message,
      http_message: statusText,
      httpCode: status,
      response: data,
    };

    console.log(JSON.stringify(logObject));

    return [status, data];
  } catch (error) {
    const errorStatusCode = error?.response?.status;
    const errorLogObject = {
      stack: error?.stack,
      message: error?.message,
      data: error?.response?.data,
      httpCode: errorStatusCode,
      httpMessage: error?.response?.statusText,
    };
    if (axios.isAxiosError(error)) {
      let message;
      if (typeof error?.response?.data === 'string') {
        message = error.response.data;
      }
      console.log(JSON.stringify(errorLogObject));
      const errResponse = message ? message : { ...error?.response?.data };
      return [errorStatusCode, errResponse];
    } else {
      console.log(JSON.stringify(errorLogObject));
      return [500, 'An unknown error occured'];
    }
  }
}


// error handler
app.use(function (err) {
  console.log(err, 'APP ERRR');
});

module.exports = app;





