import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Heart, MessageCircle, Share2 } from 'lucide-react-native';
import { Colors } from '../styles/colors';

interface PostCardProps {
    post: any;
    onShare?: () => void;
}

const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return 'Just now';

    const date = new Date(dateString);
    const now = new Date();

    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
};

export const PostCard: React.FC<PostCardProps> = ({ post, onShare }) => {
    const avatarUri = post.authorProfileImageUrl
        ? (post.authorProfileImageUrl.startsWith('http') || post.authorProfileImageUrl.startsWith('file'))
            ? post.authorProfileImageUrl
            : `data:image/jpeg;base64,${post.authorProfileImageUrl}`
        : undefined;

    return (
        <View style={styles.postCard}>

            {/* HEADER */}
            <View style={styles.postHeader}>
                <View style={styles.postUser}>
          <Image
                source={{ uri: avatarUri }}
                style={styles.postAvatar}
            />

                    <View style={styles.postMeta}>
                        <Text style={styles.postName}>
                            {post.authorDisplayName || 'Unknown User'}
                        </Text>

                        <Text style={styles.postSubtitle}>
                            {post.sport} • {formatTimeAgo(post.createdAt)}
                        </Text>
                    </View>
                </View>

                <Pressable style={styles.iconButtonSmall} onPress={onShare}>
                    <Share2 color={Colors.neutral600} size={18} strokeWidth={2.5} />
                </Pressable>
            </View>

            {/* CAPTION */}
            <Text style={styles.postText}>
                {post.caption}
            </Text>

            {/* IMAGE */}
            <Image
                source={{
                    uri: post.mediaUrl
                        ? post.mediaUrl.startsWith('http') || post.mediaUrl.startsWith('file')
                            ? post.mediaUrl
                            : `data:image/jpeg;base64,${post.mediaUrl}`
                        : undefined,
                }}
                style={styles.postImage}
            />


            {/* ACTIONS */}
            <View style={styles.postActions}>
                <View style={styles.postStats}>
                    <Heart color={Colors.neutral600} size={16} strokeWidth={2.5} />
                    <Text style={styles.postStatText}>
                        {post.likes ?? 0}
                    </Text>
                </View>

                <View style={styles.postStats}>
                    <MessageCircle color={Colors.neutral600} size={16} strokeWidth={2.5} />
                    <Text style={styles.postStatText}>
                        {post.comments ?? 0}
                    </Text>
                </View>

                <Pressable onPress={onShare} style={styles.shareAction}>
                    <Share2 color={Colors.neutral600} size={16} strokeWidth={2.5} />
                </Pressable>
            </View>

        </View>
    );
};

const styles = StyleSheet.create({
    postCard: {
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 14,
        marginBottom: 16,
    },

    postHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },

    postUser: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    postAvatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        marginRight: 10,
    },

    postMeta: {},

    postName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },

    postSubtitle: {
        fontSize: 12,
        color: '#6b7280',
    },

    iconButtonSmall: {
        padding: 6,
    },

    postLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 8,
    },

    postLabel: {
        marginLeft: 6,
        fontSize: 11,
        fontWeight: '700',
        color: Colors.primary,
        letterSpacing: 1,
    },

    postPreview: {
        position: 'relative',
    },

    postImage: {
        width: '100%',
        height: 220,
        borderRadius: 14,
    },

    playButton: {
        position: 'absolute',
        top: '42%',
        left: '42%',
        backgroundColor: 'rgba(0,0,0,0.4)',
        padding: 10,
        borderRadius: 30,
    },

    postText: {
        marginTop: 10,
        fontSize: 13,
        color: '#374151',
        lineHeight: 18,
    },

    postActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
        alignItems: 'center',
    },

    postStats: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    postStatText: {
        marginLeft: 4,
        fontSize: 12,
        color: '#6b7280',
    },

    shareAction: {
        padding: 6,
    },
});