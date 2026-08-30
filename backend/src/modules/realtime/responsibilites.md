responsibility split is:

socket.ts
Create Socket.IO server
Configure CORS
Configure Redis adapter
Register middleware
Register connection handler


socket.auth.ts
Authenticate socket
Validate WS ticket
Attach user ID

socket.events.ts
Connection event handlers
Temporary test events

socket.rooms.ts
Generate room names

For example:
user:{id}
match:{id}
spectate:{id}
socket.types.ts
TypeScript types
Socket user data
Custom event types later