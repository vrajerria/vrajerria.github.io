const io = require("socket.io")(process.env.PORT || 3000, {
  cors: { origin: "*" } 
});

let worldStates = {};

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  socket.on("joinWorld", (worldId) => {
    socket.join(worldId);
    
    // Create room if it doesn't exist
    if (!worldStates[worldId]) {
        worldStates[worldId] = { players: {}, world: null, worldSurface: null, host: socket.id };
    }
    
    // Setup player data including equipment and animation states
    worldStates[worldId].players[socket.id] = { x: 0, y: 0, hp: 100, equip: [], activeItem: null, dir: 1, swingAnim: 0 };

    // If the host has already uploaded the world, send it to this new player
    if (worldStates[worldId].world && worldStates[worldId].host !== socket.id) {
        socket.emit("worldData", { world: worldStates[worldId].world, worldSurface: worldStates[worldId].worldSurface });
    }

    io.to(worldId).emit("updatePlayers", worldStates[worldId].players);
  });

  // The Host uploads the world map so late-joiners can download it
  socket.on("hostWorld", (data) => {
    if (worldStates[data.worldId]) {
        worldStates[data.worldId].world = data.world;
        worldStates[data.worldId].worldSurface = data.worldSurface;
        socket.to(data.worldId).emit("worldData", { world: data.world, worldSurface: data.worldSurface });
    }
  });

  // Sync block breaking and placing
  socket.on("blockUpdate", (data) => {
    if (worldStates[data.worldId] && worldStates[data.worldId].world) {
        worldStates[data.worldId].world[data.x][data.y] = data.id;
        socket.to(data.worldId).emit("blockUpdated", data); 
    }
  });

  // Sync full player actions (armor, tools, swinging)
  socket.on("playerUpdate", (data) => {
    const { worldId, x, y, equip, activeItem, dir, swingAnim } = data;
    if (worldStates[worldId] && worldStates[worldId].players[socket.id]) {
      worldStates[worldId].players[socket.id] = { x, y, equip, activeItem, dir, swingAnim };
      socket.to(worldId).emit("playerUpdated", { id: socket.id, x, y, equip, activeItem, dir, swingAnim });
    }
  });

  // Host constantly syncs enemies and boss states
  socket.on("syncEntities", (data) => {
      socket.to(data.worldId).emit("entitiesSynced", data);
  });

  // Client shoots a bow/magic, tell the host to spawn it
  socket.on("clientProjectile", (data) => {
      socket.to(data.worldId).emit("spawnProjectile", data);
  });

  socket.on("disconnect", () => {
    for (let worldId in worldStates) {
      if (worldStates[worldId].players[socket.id]) {
        delete worldStates[worldId].players[socket.id];
        io.to(worldId).emit("updatePlayers", worldStates[worldId].players);
        
        // If the host leaves, make someone else the host
        if (worldStates[worldId].host === socket.id) {
            let keys = Object.keys(worldStates[worldId].players);
            if (keys.length > 0) worldStates[worldId].host = keys[0];
            else delete worldStates[worldId]; // Wipe world if empty
        }
      }
    }
  });
});
