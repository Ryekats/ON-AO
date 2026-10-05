        } else if (interaction.isStringSelectMenu()) {
          const guild = interaction.guild;
          if (!guild) return;

          const player = botClient.lavalink?.getPlayer(guild.id) || botClient.nativeVoice?.getPlayer(guild.id);
          const lang = getLanguage(guild.id, interaction.user.id);

          if (interaction.customId === 'music_search_select') {
            const selectedUrl = interaction.values[0];
            await interaction.deferUpdate().catch(() => {});
            await handleMusicCommand(interaction, 'play', { query: selectedUrl }, botClient, commandHelpers);
          } else if (interaction.customId === 'music_filter_select') {
            if (!player) {
              return await interaction.reply({ content: t('no_player', lang), ephemeral: true }).catch(() => {});
            }

            const selected = interaction.values[0];
            await interaction.deferUpdate().catch(() => {});
            if (selected === 'filter_reset') {
              if (player.set) {
                player.set('filter_bassboost', 0);
                player.set('filter_nightcore', false);
                player.set('filter_vaporwave', false);
                player.set('filter_8d', false);
                player.set('filter_vocalboost', false);
                player.set('filter_eq', 'flat');
              }
            } else if (selected === 'filter_bassboost_1') {
              if (player.set) player.set('filter_bassboost', 1);
            } else if (selected === 'filter_bassboost_2') {
              if (player.set) player.set('filter_bassboost', 2);
            } else if (selected === 'filter_bassboost_3') {
              if (player.set) player.set('filter_bassboost', 3);
            } else if (selected === 'filter_nightcore') {
              const cur = player.get ? Boolean(player.get('filter_nightcore')) : false;
              if (player.set) {
                player.set('filter_nightcore', !cur);
                if (!cur) player.set('filter_vaporwave', false);
              }
            } else if (selected === 'filter_vaporwave') {
              const cur = player.get ? Boolean(player.get('filter_vaporwave')) : false;
              if (player.set) {
                player.set('filter_vaporwave', !cur);
                if (!cur) player.set('filter_nightcore', false);
              }
            } else if (selected === 'filter_8d') {
              const cur = player.get ? Boolean(player.get('filter_8d')) : false;
              if (player.set) player.set('filter_8d', !cur);
            } else if (selected === 'filter_vocal') {
              const cur = player.get ? Boolean(player.get('filter_vocalboost')) : false;
              const next = !cur;
              if (player.set) {
                player.set('filter_vocalboost', next);
                if (next) player.set('filter_eq', 'vocal');
                else if (player.get('filter_eq') === 'vocal') player.set('filter_eq', 'flat');
              }
            } else if (selected === 'filter_hifi') {
              if (player.set) {
                player.set('filter_eq', 'hifi');
                player.set('filter_vocalboost', false);
              }
            } else if (selected === 'filter_gaming') {
              if (player.set) {
                player.set('filter_eq', 'gaming');
                player.set('filter_vocalboost', false);
              }
            }

            await applyUnifiedAudioFilters(player);
            syncPlayerState(player);
            syncAllGuildsState(botClient);

            if (interaction.message?.edit) {
              await interaction.message.edit({ components: createAudioFilterComponents(player, lang) }).catch(() => {});
            }
          }
        }