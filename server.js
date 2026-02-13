const WebSocket = require('ws');

// Render sets PORT env variable. 
// If not set (local testing), use 9080 to match Godot demo defaults.
const port = process.env.PORT || 9080;

const wss = new WebSocket.Server({ port: port });

console.log(`Signaling Server running on port ${port}`);

wss.on('connection', (ws) => {
    console.log('Client connected');

    // Assign a random ID to the client
    ws.id = Math.floor(Math.random() * 1000000);
    
    // Send the ID back to the client immediately
    const idMsg = { type: 'id', id: ws.id, data: '' };
    ws.send(JSON.stringify(idMsg));

    // Notify others? (Optional, usually we just wait for offers)
    // For a simple mesh/p2p, we might broadcast 'user_connected'
    broadcast({ type: 'user_connected', id: ws.id, data: '' }, ws);

    ws.on('message', (message) => {
        try {
            const parsed = JSON.parse(message);
            // console.log(`Received: ${parsed.type} from ${ws.id}`);
            
            // Standard Godot WebRTC Signaling Protocol:
            // { type: "offer"|"answer"|"candidate", id: target_id, data: payload }
            // The 'id' in the message usually refers to the DESTINATION or SOURCE depending on protocol flavor.
            // In the Godot Demo 'server.js':
            // Client sends { type:..., id: target_peer_id, data:... }
            // Server forwards to 'id'.
            // Server injects 'id' = sender_id into the forwarded message so the recipient knows who sent it.

            if (parsed.id) {
                const targetId = parsed.id;
                // We forward the message to the target, BUT we replace 'id' with the sender's ID
                // so the recipient knows where it came from.
                parsed.id = ws.id; 
                
                sendTo(targetId, parsed);
            } else {
                // Broadcast if no ID? (Not standard for proper P2P signalling usually, but maybe for discovery)
                // parsed.id = ws.id;
                // broadcast(parsed, ws);
            }

        } catch (e) {
            console.error('Invalid JSON', e);
        }
    });

    ws.on('close', () => {
        console.log(`Client ${ws.id} disconnected`);
        broadcast({ type: 'user_disconnected', id: ws.id, data: '' }, ws);
    });
});

function sendTo(targetId, msg) {
    wss.clients.forEach((client) => {
        // IDs might be number or string, use loose equality or conversion
        if (client.readyState === WebSocket.OPEN && client.id == targetId) {
            client.send(JSON.stringify(msg));
        }
    });
}

function broadcast(msg, exclude) {
    wss.clients.forEach((client) => {
        if (client !== exclude && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(msg));
        }
    });
}
