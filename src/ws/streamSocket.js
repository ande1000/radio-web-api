    // ============ BROADCASTER (painel) ============
    if (ws.role === 'broadcaster') {
      const ok = streamManager.setBroadcaster(ws);
      if (!ok) {
        ws.send(JSON.stringify({ type: 'error', message: 'Já existe transmissão ativa' }));
        ws.close();
        return;
      }

      console.log('🎙️  Broadcaster conectado');
      ws.send(JSON.stringify({ type: 'ready', role: 'broadcaster' }));
      streamManager.notifyListenersMeta();
      streamManager.enviarListaOuvintes();
      streamManager.enviarHistoricoChat(ws);

      ws.on('message', (data, isBinary) => {
        if (isBinary) {
          // 🔴 Agora repassa Opus (ou qualquer binário) direto
          streamManager.broadcastAudio(data);
          return;
        }

        try {
          const msg = JSON.parse(data.toString());

          if (msg.type === 'meta') {
            streamManager.updateMeta(msg);
          }

          if (msg.type === 'chat') {
            streamManager.broadcastChat({
              user: msg.user || 'locutor',
              text: msg.text,
              role: 'broadcaster',
              target: msg.target || null,
            });
          }
        } catch (err) {
          console.warn('Mensagem WS inválida (broadcaster):', err.message);
        }
      });

      ws.on('close', () => {
        console.log('🎙️  Broadcaster desconectado');
        streamManager.clearBroadcaster(ws);
        streamManager.notifyListenersMeta();
      });
    }
