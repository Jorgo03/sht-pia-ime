import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useFhoTheme } from '@/hooks/use-fho-theme';

interface SearchHeaderProps {
  title: string;
  onSearchPress?: () => void;
}

export function SearchHeader({ title, onSearchPress }: SearchHeaderProps) {
  const { colors, radii, fonts } = useFhoTheme();

  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <Text style={[styles.brand, { fontFamily: fonts.serifSemiBold, color: colors.orange1 }]}>
          Shtëpia<Text style={{ fontFamily: fonts.serif }}>.ime</Text>
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.title, { fontFamily: fonts.serif, color: colors.text }]}>
          {title}
        </Text>
        <TouchableOpacity
          style={[
            styles.searchButton,
            {
              borderRadius: radii.pill,
              backgroundColor: colors.surface2,
              borderColor: colors.borderStrong,
            },
          ]}
          onPress={onSearchPress}
          activeOpacity={0.7}>
          <MaterialIcons name="search" size={22} color={colors.orange1} />
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
    fontSize: 20,
    letterSpacing: -0.3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 30,
    flex: 1,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    marginTop: 4,
  },
});
