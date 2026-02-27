const io = require("socket.io")(process.env.PORT || 3000, {
  cors: { origin: "*" } 
});

let worldStates = {}; // Stores players for each of your 3 slots

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  socket.on("joinWorld", (worldId) => {
    socket.join(worldId); // Join the specific world slot room
    
    if (!worldStates[worldId]) worldStates[worldId] = {};
    worldStates[worldId][socket.id] = { x: 0, y: 0, hp: 100 };

    // Tell everyone in that world a new player joined
    io.to(worldId).emit("updatePlayers", worldStates[worldId]);
  });

  socket.on("playerMove", (data) => {
    const { worldId, x, y } = data;
    if (worldStates[worldId] && worldStates[worldId][socket.id]) {
      worldStates[worldId][socket.id].x = x;
      worldStates[worldId][socket.id].y = y;
      // Broadcast movement ONLY to players in the same world slot
      socket.to(worldId).emit("playerMoved", { id: socket.id, x, y });
    }
  });

  socket.on("disconnect", () => {
    // Find which world the player was in and remove them
    for (let worldId in worldStates) {
      if (worldStates[worldId][socket.id]) {
        delete worldStates[worldId][socket.id];
        io.to(worldId).emit("updatePlayers", worldStates[worldId]);
      }
    }
  });
});