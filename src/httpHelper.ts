import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

/**
 * Performs a zero-dependency JSON POST request using standard Node.js APIs.
 * Supports both http and https protocols.
 */
export function postJson(url: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      const postData = JSON.stringify(data);
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const requester = parsedUrl.protocol === 'https:' ? https : http;

      const req = requester.request(options, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve({ status: 'error', message: 'Failed parsing response', raw: body });
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.write(postData);
      req.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Performs a zero-dependency JSON GET request.
 */
export function getJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      };

      const requester = parsedUrl.protocol === 'https:' ? https : http;

      const req = requester.request(options, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve({ status: 'error', message: 'Failed parsing response', raw: body });
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.end();
    } catch (error) {
      reject(error);
    }
  });
}
