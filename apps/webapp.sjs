var manifest = {
  "name": "Super Crazy Basic App",
  "installs_allowed_from": [ "*" ],
//  "type": "certified",
  "permissions": {
    "geolocation": {
      "description": "geolocate"
    },
    "alarm": {
      "description": "wake up",
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
