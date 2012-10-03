var manifest = {
  "name": "Super Crazy Basic App",
  "installs_allowed_from": [ "*" ],
  // remove type for web apps
  "type": "certified",
  // package_path is needed for package apps
  "package_path": "http://example.com/tests/webapi/app.zip",
  "permissions": {
    "geolocation": {
      "description": "geolocate"
    },
    "contacts": {
      "description": "contacts",
      "access": "readwrite"
    }
  }
}

function handleRequest(request, response)
{
  // avoid confusing cache behaviors
  response.setHeader("Cache-Control", "no-cache", false);

  response.setHeader("Content-Type", "application/x-web-app-manifest+json", false);
  response.write(JSON.stringify(manifest));
}
