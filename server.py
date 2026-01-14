
import http.server
import socketserver
import os
import json
import time

PORT = 8100
EPISODES_DIR = "episodes"

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/save':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                
                # Generate filename
                timestamp = int(time.time())
                filename = f"episode_{timestamp}.json"
                filepath = os.path.join(EPISODES_DIR, filename)
                
                # Save to file
                with open(filepath, 'w') as f:
                    json.dump(data, f, indent=2)
                
                print(f"Saved episode to {filepath}")
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success', 'file': filename}).encode())
                
            except Exception as e:
                print(f"Error saving episode: {e}")
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode())
        else:
            self.send_error(404)

if __name__ == "__main__":
    if not os.path.exists(EPISODES_DIR):
        os.makedirs(EPISODES_DIR)
        
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving at port {PORT}")
        print(f"Episodes will be saved to ./{EPISODES_DIR}")
        httpd.serve_forever()
