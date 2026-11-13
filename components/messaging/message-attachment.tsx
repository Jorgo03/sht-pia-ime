import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { memo, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { type AtticoPalette, Fonts } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useAttachmentUrl } from '@/lib/message-attachments';
import { formatBytes, type Attachment } from '@/src/features/messaging/lib/attachments';

const iconFor = (mime: string): keyof typeof MaterialIcons.glyphMap =>
  mime === 'application/pdf'
    ? 'picture-as-pdf'
    : mime.includes('sheet') || mime.includes('excel')
      ? 'table-chart'
      : 'description';

/**
 * A photo or document inside a chat bubble. The bucket is private, so it is
 * shown through a link that lasts an hour (lib/message-attachments.ts). A tap
 * opens it full size in the in-app browser, which also views PDFs and Office
 * files and lets the person save or share them.
 */
function MessageAttachmentBase({ attachment, mine }: { attachment: Attachment; mine: boolean }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: url, isError, refetch } = useAttachmentUrl(attachment.path);
  const open = () => {
    if (url) void WebBrowser.openBrowserAsync(url).catch(() => undefined);
    else if (isError) void refetch();
  };
  const label = t('messages.openAttachment', { name: attachment.name });

  if (attachment.kind === 'image') {
    return (
      // "button", not "imagebutton": the web has no such role, and the photo
      // came out as an unnamed image there.
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} onPress={open} activeOpacity={0.85}>
        <View style={styles.photoFrame}>
          {url ? (
            <Image source={{ uri: url }} style={styles.photo} contentFit="cover" transition={150} recyclingKey={attachment.path} />
          ) : isError ? (
            <MaterialIcons name="broken-image" size={28} color={colors.textSecondary} />
          ) : (
            <ActivityIndicator color={mine ? '#fff' : colors.accent} />
          )}
        </View>
      </TouchableOpacity>
    );
  }

  const size = formatBytes(attachment.size, i18n.language);
  return (
    <TouchableOpacity
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={open}
      activeOpacity={0.8}
      style={[styles.file, mine && styles.fileMine]}>
      <MaterialIcons name={iconFor(attachment.mime)} size={26} color={mine ? '#fff' : colors.accent} />
      <View style={styles.fileText}>
        <Text style={[styles.fileName, mine && styles.textMine]} numberOfLines={2}>
          {attachment.name}
        </Text>
        {size ? <Text style={[styles.fileSize, mine && styles.subMine]}>{size}</Text> : null}
      </View>
      <MaterialIcons name="open-in-new" size={18} color={mine ? 'rgba(255,255,255,0.85)' : colors.textSecondary} />
    </TouchableOpacity>
  );
}

export const MessageAttachment = memo(MessageAttachmentBase);

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    photoFrame: {
      width: 220,
      maxWidth: '100%',
      aspectRatio: 4 / 3,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 2,
    },
    photo: { width: '100%', height: '100%' },
    file: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 48,
      minWidth: 200,
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: 10,
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 2,
    },
    fileMine: { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.3)' },
    fileText: { flexShrink: 1, flexGrow: 1 },
    fileName: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.textPrimary },
    fileSize: { fontFamily: Fonts.sans, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
    textMine: { color: '#fff' },
    subMine: { color: 'rgba(255,255,255,0.8)' },
  });
