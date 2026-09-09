/**
 * On Ao Discord Music Bot - Voice Protection Engine
 * Implements "Return to Origin" (Anti-Drag Protection) and "Anti-Disconnect" (Seamless Playback Restoration)
 */
const { EmbedBuilder, AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const { getLanguage, t } = require('../../bot-i18n.cjs');

const guildPlaybackSnapshots = new Map();

function getGuildPlaybackSnapshot(guildId) {
  return guildPlaybackSnapshots.get(guildId) || null;
}

function saveGuildPlaybackSnapshot(guildId, player, extraData = {}) {
  if (!guildId) return;

  const currentTrack = extraData.currentTrack || player?.queue?.current || player?.get?.('currentTrack') || null;
  const position = typeof extraData.position === 'number' ? extraData.position : (player?.position || player?.lastPlaybackPosition || 0);

  let queueTracks = [];
  if (Array.isArray(extraData.queueTracks)) {
    queueTracks = extraData.queueTracks;
  } else if (player?.queue?.tracks) {
    queueTracks = Array.from(player.queue.tracks);
  } else if (player?.queue) {
    queueTracks = Array.from(player.queue);
  }

  const snapshot = {
    guildId,
    voiceChannelId: extraData.voiceChannelId || player?.sessionVoiceChannelId || player?.voiceChannelId || null,
    textChannelId: extraData.textChannelId || player?.textChannelId || null,
    initiatorId: extraData.initiatorId || player?.sessionInitiatorId || null,
    currentTrack,
    position,
    duration: currentTrack ? (currentTrack.duration || currentTrack.info?.duration || 0) : 0,
    isPlaying: Boolean(player?.playing),
    volume: typeof player?.volume === 'number' ? player.volume : 100,
    repeatMode: player?.repeatMode || 'off',
    autoplay: player?.get ? Boolean(player.get('autoplay')) : false,
    is247: player?.get ? Boolean(player.get('is247')) : false,
    filter_bassboost: player?.get ? player.get('filter_bassboost') : 0,
    filter_nightcore: player?.get ? Boolean(player.get('filter_nightcore')) : false,
    filter_vaporwave: player?.get ? Boolean(player.get('filter_vaporwave')) : false,
    filter_8d: player?.get ? Boolean(player.get('filter_8d')) : false,
    filter_eq: player?.get ? player.get('filter_eq') : 'flat',
    queueTracks,
    savedAt: Date.now()
  };

  guildPlaybackSnapshots.set(guildId, snapshot);
  return snapshot;
}

/**
 * Hard Purge Voice Session via Gateway Opcode 4 (channel_id: null)
 */
async function hardPurgeVoiceSession(guild, player, getVoiceConnectionFn) {
  if (!guild) return;

  try {
    if (getVoiceConnectionFn) {
      const conn = getVoiceConnectionFn(guild.id);
      if (conn) conn.destroy();
    }

    if (player) {
      if (player.connection) {
        try { player.connection.disconnect(); } catch (e) {}
        player.connection = null;
      }
      if (typeof player.disconnect === 'function') {
        try { await player.disconnect(); } catch (e) {}
      }
      player.connected = false;
      player.voiceChannelId = null;
    }

    if (guild.shard) {
      guild.shard.send({
        op: 4,
        d: {
          guild_id: guild.id,
          channel_id: null,
          self_mute: false,
          self_deaf: false
        }
      });
      console.log(`[VOICE PURGE] 📡 Gateway opcode 4 (channel_id: null) sent for guild ${guild.id}.`);
    }
  } catch (err) {
    console.warn(`[VOICE PURGE WARN] Failed to send Opcode 4:`, err.message);
  }
}

/**
 * Handles "Return to Origin" when bot is forcefully moved to another channel by Admin/Mod
 */
async function handleReturnToOrigin(oldState, newState, player, botClient) {
  const guild = oldState.guild;
  const initiatorId = player.sessionInitiatorId;

  // 1. Fetch real-time user data of session owner (first user)
  let originalOwnerMember = null;
  let targetChannelId = player.sessionVoiceChannelId || oldState.channelId;

  if (initiatorId) {
    try {
      originalOwnerMember = await guild.members.fetch(initiatorId).catch(() => null);
      if (originalOwnerMember?.voice?.channelId) {
        // Always follow where the first user currently is
        targetChannelId = originalOwnerMember.voice.channelId;
        player.sessionVoiceChannelId = targetChannelId;
      }
    } catch (fetchErr) {}
  }

  // Bot arrived back home at the target channel
  if (newState.channelId === targetChannelId) {
    player.isReturningToOrigin = false;
    player.voiceChannelId = targetChannelId;
    player.sessionVoiceChannelId = targetChannelId;
    console.log(`[RETURN TO ORIGIN] ✅ Bot has successfully returned to origin/owner channel (${targetChannelId}).`);
    return;
  }

  const originalChannel = guild.channels.cache.get(targetChannelId) || await guild.channels.fetch(targetChannelId).catch(() => null);

  const ownerUserId = initiatorId || 'Unknown';
  const ownerDisplayName = originalOwnerMember?.displayName ||
    originalOwnerMember?.user?.globalName ||
    originalOwnerMember?.user?.username ||
    player.sessionInitiatorDisplayName ||
    player.sessionInitiatorUsername ||
    'Original Owner';

  // 2. Audit log inspection for Moderator/Admin action
  let moverMember = null;
  let isModeratorAction = false;
  let moverRoleName = 'Member';
  try {
    const auditLogs = await guild.fetchAuditLogs({
      type: AuditLogEvent.MemberMove,
      limit: 1
    }).catch(() => null);

    const moveEntry = auditLogs?.entries?.first();
    if (moveEntry && (Date.now() - moveEntry.createdTimestamp) < 15000) {
      const executor = moveEntry.executor;
      if (executor) {
        moverMember = await guild.members.fetch(executor.id).catch(() => null);
        if (moverMember) {
          const isAdmin = moverMember.permissions.has(PermissionFlagsBits.Administrator);
          const isMod = moverMember.permissions.has(PermissionFlagsBits.ModerateMembers) ||
            moverMember.permissions.has(PermissionFlagsBits.MoveMembers);
          isModeratorAction = isAdmin || isMod;
          moverRoleName = isAdmin ? 'Administrator' : (isMod ? 'Moderate Members / Moderator' : 'Member');
        }
      }
    }
  } catch (auditErr) {
    console.warn('[RETURN TO ORIGIN AUDIT LOG]', auditErr.message);
  }

  // 3. Trigger Return to Origin
  const originName = originalChannel?.name || targetChannelId;
  console.log(`[RETURN TO ORIGIN] 🛡️ Return to Origin triggered in guild "${guild.name}"! Bot moved to channel <#${newState.channelId}> by ${moverMember ? `${moverMember.displayName} (${moverRoleName})` : 'External Action'}. Returning bot to target (${originName}) for owner: ${ownerDisplayName} (${ownerUserId}).`);

  player.isReturningToOrigin = true;
  player.sessionVoiceChannelId = targetChannelId;

  const executeReturnToOrigin = async () => {
    // Method 1: Discord REST setChannel
    let moveSuccess = false;
    try {
      const me = guild.members.me || await guild.members.fetch(botClient.user.id).catch(() => null);
      if (me?.voice) {
        await me.voice.setChannel(targetChannelId, `Return to Origin: Session protected for ${ownerDisplayName} (${ownerUserId})`);
        console.log(`[RETURN TO ORIGIN] 🚀 me.voice.setChannel(${targetChannelId}) executed.`);
        moveSuccess = true;
      } else if (newState.setChannel) {
        await newState.setChannel(targetChannelId, `Return to Origin: Session protected for ${ownerDisplayName} (${ownerUserId})`);
        moveSuccess = true;
      }
    } catch (restErr) {
      console.warn('[RETURN TO ORIGIN REST ERR]', restErr.message);
    }

    // Method 2: Gateway Voice State Update
    if (!moveSuccess) {
      try {
        player.voiceChannelId = targetChannelId;
        player.sessionVoiceChannelId = targetChannelId;
        if (typeof player.changeVoiceState === 'function') {
          await player.changeVoiceState({ voiceChannelId: targetChannelId });
        } else if (typeof player.connect === 'function') {
          await player.connect();
        } else if (botClient.nativeVoice) {
          botClient.nativeVoice.joinChannel(guild, targetChannelId);
        }
      } catch (gatewayErr) {
        console.warn('[RETURN TO ORIGIN GATEWAY ERR]', gatewayErr.message);
      }
    }

    // Safety clear of flag after 1.5s
    setTimeout(() => {
      player.isReturningToOrigin = false;
    }, 1500);

    // Send notification embed
    try {
      const textCh = guild.channels.cache.get(player.textChannelId) || await guild.channels.fetch(player.textChannelId).catch(() => null);
      if (textCh && textCh.isTextBased()) {
        const lang = getLanguage(guild.id);
        const isEn = lang === 'en';
        const title = isEn ? '🛡️ Return to Origin — Session Protected' : '🛡️ Return to Origin — Sesi Dilindungi';

        const moverInfo = isModeratorAction
          ? (isEn
              ? `Moderator Action detected: Moved by **${moverMember?.displayName || 'Moderator'}** (\`${moverRoleName}\`).`
              : `Tindakan Moderator terdeteksi: Dipindahkan oleh **${moverMember?.displayName || 'Moderator'}** (\`${moverRoleName}\`).`)
          : (isEn ? 'Native UI channel move detected.' : 'Pemindahan voice channel melalui native UI Discord terdeteksi.');

        const desc = isEn
          ? `${moverInfo}\n\n` +
            `**Real-Time Session Protection (Guild Members Intent):**\n` +
            `• **Original Owner:** **${ownerDisplayName}** (\`${ownerUserId}\`)\n` +
            `• **Origin Voice Channel:** <#${targetChannelId}>\n\n` +
            `The bot has automatically returned to the origin voice channel and continues following **${ownerDisplayName}**, ensuring the listening session is not interrupted.`
          : `${moverInfo}\n\n` +
            `**Proteksi Sesi Real-Time (Guild Members Intent):**\n` +
            `• **Pemilik Sesi Asal (Original Owner):** **${ownerDisplayName}** (\`${ownerUserId}\`)\n` +
            `• **Voice Channel Asal:** <#${targetChannelId}>\n\n` +
            `Bot telah secara otomatis kembali ke voice channel asal dan tetap mengikuti **${ownerDisplayName}** agar sesi musik berjalan tanpa gangguan.`;

        textCh.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x6366f1)
              .setTitle(title)
              .setDescription(desc)
              .setFooter({ text: 'On Ao Discord Music Bot • Voice Persistence & Guild Members Intent' })
              .setTimestamp()
          ]
        }).catch(() => {});
      }
    } catch (msgErr) {}
  };

  // 200ms delay per established pattern for Gateway processing
  setTimeout(executeReturnToOrigin, 200);
}

/**
 * Handles "Tetap Mengikuti User Pertama" (Follow Session Initiator)
 * When the first user moves to another voice channel, bot automatically follows them.
 */
async function handleFollowInitiator(oldState, newState, player, botClient) {
  if (!player || !oldState.channelId || !newState.channelId || oldState.channelId === newState.channelId) return;
  const guild = newState.guild;

  // Check if player is active
  const isSessionActive = Boolean(
    player.connected &&
    (player.playing ||
     player.queue?.current ||
     (player.queue?.tracks && player.queue.tracks.length > 0) ||
     player.get?.('is247'))
  );

  if (!isSessionActive) return;

  // If bot is already in target channel, just update state
  if (player.voiceChannelId === newState.channelId) {
    player.sessionVoiceChannelId = newState.channelId;
    return;
  }

  const userDisplayName = newState.member?.displayName || newState.member?.user?.username || 'User Pertama';
  console.log(`[FOLLOW INITIATOR] 🏃 Session Initiator (${userDisplayName}) moved from ${oldState.channelId} to ${newState.channelId}. Bot following user...`);

  player.sessionVoiceChannelId = newState.channelId;
  player.voiceChannelId = newState.channelId;
  player.isReturningToOrigin = true;

  try {
    const me = guild.members.me || await guild.members.fetch(botClient.user.id).catch(() => null);
    if (me?.voice) {
      await me.voice.setChannel(newState.channelId, `Follow Session Owner: ${userDisplayName}`);
    } else if (typeof player.changeVoiceState === 'function') {
      await player.changeVoiceState({ voiceChannelId: newState.channelId });
    } else if (typeof player.connect === 'function') {
      await player.connect();
    }
  } catch (err) {
    console.warn('[FOLLOW INITIATOR MOVE ERR]', err.message);
    try {
      if (typeof player.changeVoiceState === 'function') {
        await player.changeVoiceState({ voiceChannelId: newState.channelId });
      } else if (typeof player.connect === 'function') {
        await player.connect();
      }
    } catch (e2) {}
  }

  setTimeout(() => {
    player.isReturningToOrigin = false;
  }, 1000);

  // Send feedback to text channel
  try {
    const textChId = player.textChannelId;
    const textCh = textChId ? (guild.channels.cache.get(textChId) || await guild.channels.fetch(textChId).catch(() => null)) : null;
    if (textCh && textCh.isTextBased()) {
      const lang = getLanguage(guild.id);
      const isEn = lang === 'en';

      textCh.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x10b981)
            .setTitle(isEn ? '🚶 Following Session Owner' : '🚶 Mengikuti Pengguna Pertama')
            .setDescription(
              isEn
                ? `Bot has automatically followed **${userDisplayName}** to <#${newState.channelId}> to continue playback without interruption.`
                : `Bot otomatis mengikuti **${userDisplayName}** ke voice channel <#${newState.channelId}> agar sesi pemutaran musik tetap berlanjut.`
            )
            .setFooter({ text: 'On Ao Music Studio • Anti-Drag & Follow First User' })
            .setTimestamp()
        ]
      }).catch(() => {});
    }
  } catch (msgErr) {}
}

/**
 * Handles "Anti-Disconnect" when bot is unexpectedly disconnected/kicked from voice
 */
async function handleAntiDisconnect(oldState, player, botClient, helpers) {
  const { getTrackTitle, syncPlayerState, applyUnifiedAudioFilters, getVoiceConnection } = helpers;
  const guild = oldState.guild;

  console.log(`[VOICE DISCONNECT] ⚠️ Bot detected disconnection from voice channel (${oldState.channelId}) in guild "${guild.name}".`);

  // Snapshot playback state BEFORE purge
  const snapshot = guildPlaybackSnapshots.get(guild.id) || {};
  const curTrack = player?.queue?.current || player?.get?.('currentTrack') || snapshot.currentTrack;
  let realPosition = 0;
  if (typeof player?.position === 'number' && player.position > 0) {
    realPosition = player.position;
  } else if (typeof player?.lastPlaybackPosition === 'number' && player.lastPlaybackPosition > 0) {
    realPosition = player.lastPlaybackPosition;
  } else if (snapshot.position) {
    const elapsed = (snapshot.isPlaying && snapshot.savedAt) ? (Date.now() - snapshot.savedAt) : 0;
    realPosition = Math.min(snapshot.duration || Infinity, snapshot.position + elapsed);
  }

  saveGuildPlaybackSnapshot(guild.id, player, {
    currentTrack: curTrack,
    position: realPosition,
    savedAt: Date.now()
  });

  const isLegitDisconnect = Boolean(player?.manualDisconnect);
  if (isLegitDisconnect) {
    console.log(`[VOICE] 🚪 Official manual disconnect in guild "${guild.name}". Destroying player cleanly.`);
    if (player) {
      player.manualDisconnect = false;
      player.sessionInitiatorId = null;
    }
    guildPlaybackSnapshots.delete(guild.id);
    await hardPurgeVoiceSession(guild, player, getVoiceConnection);
    if (player) await player.destroy().catch(() => {});
    return;
  }

  const returnChannelId = player?.sessionVoiceChannelId || player?.voiceChannelId || snapshot.voiceChannelId || oldState.channelId;
  const returnChannel = guild.channels.cache.get(returnChannelId);
  const wasActive = Boolean(player?.playing || curTrack || (player?.queue?.tracks && player.queue.tracks.length > 0) || (snapshot.queueTracks && snapshot.queueTracks.length > 0) || player?.get?.('is247') || snapshot.is247);

  if (wasActive && returnChannel) {
    console.log(`[ANTI-DISCONNECT] 🛡️ Anti-Disconnect triggered in guild "${guild.name}". Last track: "${getTrackTitle(curTrack)}" at ${Math.floor(realPosition / 1000)}s.`);
    console.log(`[ANTI-DISCONNECT] ⏳ Delaying 1.5s for Discord Gateway session reset...`);

    await hardPurgeVoiceSession(guild, player, getVoiceConnection);
    if (player) player.isAutoReconnecting = true;

    setTimeout(async () => {
      try {
        console.log(`[ANTI-DISCONNECT] 🔄 Reconnecting to "${returnChannel.name}" and resuming playback...`);

        const finalSnapshot = guildPlaybackSnapshots.get(guild.id) || {};
        const savedTrack = finalSnapshot.currentTrack;
        const savedPosition = finalSnapshot.position || 0;
        const savedQueue = finalSnapshot.queueTracks || [];
        const textChannelId = finalSnapshot.textChannelId || player?.textChannelId;
        const initiatorId = finalSnapshot.initiatorId || player?.sessionInitiatorId;
        const volume = finalSnapshot.volume || 100;
        const repeatMode = finalSnapshot.repeatMode || 'off';
        const autoplay = finalSnapshot.autoplay;
        const is247 = finalSnapshot.is247;

        let activePlayer = botClient.lavalink?.getPlayer(guild.id) || botClient.nativeVoice?.getPlayer(guild.id);
        const connectedNodes = Array.from(botClient.lavalink?.nodeManager?.nodes?.values() || []).filter(n => n.connected);

        if (!activePlayer || activePlayer.getData?.('internal_destroystatus')) {
          if (connectedNodes.length > 0) {
            activePlayer = botClient.lavalink.createPlayer({
              guildId: guild.id,
              voiceChannelId: returnChannelId,
              textChannelId: textChannelId || undefined,
              selfDeaf: true,
              volume: volume || 100
            });
          } else if (botClient.nativeVoice) {
            activePlayer = botClient.nativeVoice.createPlayer({
              guildId: guild.id,
              voiceChannelId: returnChannelId,
              textChannelId: textChannelId || undefined,
              selfDeaf: true,
              volume: volume || 100
            });
          }
        }

        if (!activePlayer) {
          console.error(`[ANTI-DISCONNECT] ❌ Failed to create player for guild "${guild.name}".`);
          return;
        }

        activePlayer.isAutoReconnecting = true;
        activePlayer.voiceChannelId = returnChannelId;
        activePlayer.sessionVoiceChannelId = returnChannelId;
        if (initiatorId) activePlayer.sessionInitiatorId = initiatorId;
        activePlayer.volume = volume;
        activePlayer.repeatMode = repeatMode;
        if (autoplay && activePlayer.set) activePlayer.set('autoplay', true);
        if (is247 && activePlayer.set) activePlayer.set('is247', true);

        if (finalSnapshot.filter_bassboost !== undefined && activePlayer.set) activePlayer.set('filter_bassboost', finalSnapshot.filter_bassboost);
        if (finalSnapshot.filter_nightcore !== undefined && activePlayer.set) activePlayer.set('filter_nightcore', finalSnapshot.filter_nightcore);
        if (finalSnapshot.filter_vaporwave !== undefined && activePlayer.set) activePlayer.set('filter_vaporwave', finalSnapshot.filter_vaporwave);
        if (finalSnapshot.filter_8d !== undefined && activePlayer.set) activePlayer.set('filter_8d', finalSnapshot.filter_8d);
        if (finalSnapshot.filter_eq !== undefined && activePlayer.set) activePlayer.set('filter_eq', finalSnapshot.filter_eq);

        if (typeof applyUnifiedAudioFilters === 'function') {
          applyUnifiedAudioFilters(activePlayer).catch(() => {});
        }

        const resumeMs = Math.max(0, Math.floor(savedPosition));
        const resumeSec = Math.floor(resumeMs / 1000);

        if (typeof activePlayer.reconnectAndResume === 'function') {
          await activePlayer.reconnectAndResume(returnChannelId, savedTrack, resumeSec);
        } else {
          await activePlayer.connect();
          await new Promise(r => setTimeout(r, 600));

          if (savedQueue && savedQueue.length > 0) {
            if (activePlayer.queue?.add) {
              await activePlayer.queue.add(savedQueue).catch(() => {});
            } else if (activePlayer.queue?.tracks) {
              activePlayer.queue.tracks = [...savedQueue];
            }
          }

          if (savedTrack) {
            if (activePlayer.queue) {
              activePlayer.queue.current = savedTrack;
            }

            const playOpts = {
              clientTrack: savedTrack,
              position: resumeMs
            };
            if (savedTrack.encoded) {
              playOpts.track = { encoded: savedTrack.encoded };
            }

            await activePlayer.play(playOpts).catch(async () => {
              if (activePlayer.queue) {
                await activePlayer.queue.add(savedTrack).catch(() => {});
                await activePlayer.play({ position: resumeMs }).catch(() => {});
              }
            });

            setTimeout(async () => {
              try {
                if (activePlayer.playing && resumeMs > 2000 && Math.abs((activePlayer.position || 0) - resumeMs) > 4000) {
                  await activePlayer.seek(resumeMs).catch(() => {});
                }
              } catch (e) {}
            }, 1200);
          }
        }

        activePlayer.isAutoReconnecting = false;
        if (syncPlayerState) syncPlayerState(activePlayer);

        const textCh = guild.channels.cache.get(textChannelId);
        if (textCh && textCh.isTextBased()) {
          const lang = getLanguage(guild.id);
          const minutes = Math.floor(resumeSec / 60);
          const seconds = String(resumeSec % 60).padStart(2, '0');
          const timeFormatted = `${minutes}:${seconds}`;

          textCh.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0x10b981)
                .setTitle(lang === 'en' ? '🛡️ Voice Connection Re-Patched & Resumed' : '🛡️ Koneksi Suara Berhasil di Re-Patch & Dilanjutkan')
                .setDescription(
                  savedTrack
                    ? (lang === 'en'
                      ? `Bot automatically reconnected to <#${returnChannelId}> and resumed **${getTrackTitle(savedTrack)}** from \`${timeFormatted}\`!`
                      : `Bot otomatis bergabung kembali ke <#${returnChannelId}> dan melanjutkan **${getTrackTitle(savedTrack)}** dari detik \`${timeFormatted}\`!`)
                    : t('anti_disconnect_notice', lang, {
                        channel: returnChannelId,
                        initiator: initiatorId || 'Inisiator'
                      })
                )
                .setFooter({ text: 'On Ao Music Studio • Anti-Disconnect Protection', iconURL: botClient.user.displayAvatarURL() })
            ]
          }).catch(() => {});
        }
      } catch (reconnectErr) {
        console.warn('[ANTI-DISCONNECT RECONNECT ERR]', reconnectErr.message);
        if (player) player.isAutoReconnecting = false;
      }
    }, 1500);
  } else {
    console.log(`[VOICE] Bot disconnected from voice channel in guild ${oldState.guild.name}. Cleaning player.`);
    await hardPurgeVoiceSession(guild, player, getVoiceConnection);
    if (player) await player.destroy().catch(() => {});
  }
}

module.exports = {
  guildPlaybackSnapshots,
  getGuildPlaybackSnapshot,
  saveGuildPlaybackSnapshot,
  hardPurgeVoiceSession,
  handleReturnToOrigin,
  handleFollowInitiator,
  handleAntiDisconnect
};
