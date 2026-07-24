/**
 * Modal Handlers
 * Handles saving configuration for all condition block modals
 * Extracted from Canvas.jsx to reduce file size
 */

export const createModalHandlers = (setNodes) => {
  return {
    handleSaveKeywords: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                keywords: config.keywords,
                name: config.name,
                fields: config.fields,
                exclude: config.exclude,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveRegex: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                pattern: config.pattern,
                name: config.name,
                fields: config.fields,
                exclude: config.exclude,
                flags: config.flags,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveLanguage: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                languages: config.languages,
                name: config.name,
                exclude: config.exclude,
              },
            }
          }
          return node
        })
      )
    },

    handleSavePostType: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                types: config.types,
                name: config.name,
                exclude: config.exclude,
                replyDepthEnabled: config.replyDepthEnabled,
                replyDepthOperator: config.replyDepthOperator,
                replyDepth: config.replyDepth,
                postTypeScores: config.postTypeScores,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveAuthor: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                authors: config.authors,
                listUris: config.listUris,
                name: config.name,
                exclude: config.exclude,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveMediaType: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                types: config.types,
                name: config.name,
                exclude: config.exclude,
                mediaTypeScores: config.mediaTypeScores,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveHashtag: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                tags: config.tags,
                fieldTypes: config.fieldTypes,
                name: config.name,
                exclude: config.exclude,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveLabels: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                labels: config.labels,
                name: config.name,
                exclude: config.exclude,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveDateAge: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                mode: config.mode,
                value: config.value,
                name: config.name,
                exclude: config.exclude,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveNOf: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                n: config.n,
                // M is calculated dynamically, don't store it
              },
            }
          }
          return node
        })
      )
    },

    handleSaveManualPosts: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                posts: config.posts,
                name: config.name,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveEngagement: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                metricType: config.metricType,
                operator: config.operator,
                threshold: config.threshold,
              },
            }
          }
          return node
        })
      )
    },

    handleSavePostStructure: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                structureType: config.structureType,
                operator: config.operator,
                depth: config.depth,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveMentions: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                mentions: config.mentions,
                listUris: config.listUris,
                name: config.name,
                exclude: config.exclude,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveLinks: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                urls: config.urls,
                name: config.name,
                exclude: config.exclude,
                requireThumbnail: config.requireThumbnail || false,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveQuotePost: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                uris: config.uris || [],
                dids: config.dids || [],
                name: config.name,
                exclude: config.exclude,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveImage: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                imageCount: config.imageCount,
                minWidth: config.minWidth,
                maxWidth: config.maxWidth,
                minHeight: config.minHeight,
                maxHeight: config.maxHeight,
                aspectRatio: config.aspectRatio,
                minFileSize: config.minFileSize,
                maxFileSize: config.maxFileSize,
                exclude: config.exclude,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveVideo: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                minWidth: config.minWidth,
                maxWidth: config.maxWidth,
                minHeight: config.minHeight,
                maxHeight: config.maxHeight,
                aspectRatio: config.aspectRatio,
                minFileSize: config.minFileSize,
                maxFileSize: config.maxFileSize,
                presentation: config.presentation,
                exclude: config.exclude,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveRecency: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                decayHours: config.decayHours,
                maxBoost: config.maxBoost,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveEngagementScore: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                likeWeight: config.likeWeight,
                replyWeight: config.replyWeight,
                repostWeight: config.repostWeight,
                quoteWeight: config.quoteWeight,
                bookmarkWeight: config.bookmarkWeight,
                weights: {
                  like: config.likeWeight,
                  reply: config.replyWeight,
                  repost: config.repostWeight,
                  quote: config.quoteWeight,
                  bookmark: config.bookmarkWeight,
                },
              },
            }
          }
          return node
        })
      )
    },

    handleSaveCustomScore: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                score: config.score,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveRotatingPosts: (config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === config.nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                postUrls: config.postUrls,
                strategy: config.strategy,
                name: config.name,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveChronological: (config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === config.nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                order: config.order,
                name: config.name,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveDynamicPinned: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                position: config.position,
                apiEndpoint: config.apiEndpoint,
                name: config.name,
              },
            }
          }
          return node
        })
      )
    },

    handleSavePinnedPosts: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                items: Array.isArray(config.items) ? config.items : [],
                name: config.name,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveFeaturedPost: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                position: config.position,
                apiEndpoint: config.apiEndpoint,
                name: config.name,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveFixedChronological: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                startPosition: config.startPosition,
                endPosition: config.endPosition,
                order: config.order,
                name: config.name,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveFixedByScore: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                startPosition: config.startPosition,
                endPosition: config.endPosition,
                name: config.name,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveFixedMostLikes: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                startPosition: config.startPosition,
                endPosition: config.endPosition,
                name: config.name,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveFixedMostEngagement: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                startPosition: config.startPosition,
                endPosition: config.endPosition,
                name: config.name,
              },
            }
          }
          return node
        })
      )
    },

    handleSaveFixedRandom: (nodeId, config) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                startPosition: config.startPosition,
                endPosition: config.endPosition,
                name: config.name,
              },
            }
          }
          return node
        })
      )
    },
  }
}
