import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AtticoColors } from '@/constants/theme';

interface SearchHeaderProps {
  title: string;
  onSearchPress?: () => void;
}

export function SearchHeader({ title, onSearchPress }: SearchHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <Text style={styles.brand}>Shtëpia.ime</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={onSearchPress}
          activeOpacity={0.7}>
          <MaterialIcons name="search" size={22} color={AtticoColors.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  brandRow: {
    marginBottom: 12,
  },
  brand: {
    fontSize: 14,
    fontWeight: '600',
    color: AtticoColors.accent,
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: AtticoColors.textPrimary,
    flex: 1,
    lineHeight: 36,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AtticoColors.glass,
    borderWidth: 1,
    borderColor: AtticoColors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    marginTop: 4,
  },
});
