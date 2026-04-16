import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { getQuestionnaires, Questionnaire } from '@/utils/api';

export default function HomeScreen() {
  const router = useRouter();
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const data = await getQuestionnaires();
      setQuestionnaires(data);
    } catch (error) {
      console.error('Failed to fetch questionnaires:', error);
      Alert.alert('错误', '获取问卷列表失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isDeadlinePassed = (deadline: string) => {
    return new Date(deadline) < new Date();
  };

  const getStatusBadge = (questionnaire: Questionnaire) => {
    const passed = isDeadlinePassed(questionnaire.deadline);
    if (passed && questionnaire.status === 'active') {
      return (
        <View style={[styles.badge, styles.badgeExpired]}>
          <Text style={styles.badgeText}>已过期</Text>
        </View>
      );
    }
    if (questionnaire.status === 'completed') {
      return (
        <View style={[styles.badge, styles.badgeCompleted]}>
          <Text style={styles.badgeText}>已分析</Text>
        </View>
      );
    }
    return (
      <View style={[styles.badge, styles.badgeActive]}>
        <Text style={styles.badgeText}>收集中</Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: Questionnaire }) => (
    <TouchableOpacity
      style={styles.cardOuter}
      onPress={() => router.push(`/detail/${item.id}`)}
      activeOpacity={0.9}
    >
      <View style={styles.cardShadow}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
              {getStatusBadge(item)}
            </View>
            {item.description ? (
              <Text style={styles.cardDescription} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
          </View>
          <View style={styles.cardFooter}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>截止时间</Text>
              <Text style={styles.infoValue}>{formatDate(item.deadline)}</Text>
            </View>
            <View style={styles.qrPreview}>
              {item.qr_code_url ? (
                <Image
                  source={{ uri: item.qr_code_url }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.qrPlaceholder} />
              )}
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>暂无问卷</Text>
      <Text style={styles.emptyDescription}>
        点击下方按钮创建第一个培训需求问卷
      </Text>
    </View>
  );

  return (
    <Screen>
      <View style={styles.container}>
        <LinearGradient
          colors={['#6C63FF', '#896BFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>培训需求收集</Text>
          <Text style={styles.headerSubtitle}>
            收集、分析、生成报告
          </Text>
        </LinearGradient>

        <View style={styles.content}>
          <FlatList
            data={questionnaires}
            renderItem={renderItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#6C63FF']}
                tintColor="#6C63FF"
              />
            }
            ListEmptyComponent={!loading ? renderEmpty : null}
          />
        </View>

        <TouchableOpacity
          style={styles.fabContainer}
          onPress={() => router.push('/create')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#6C63FF', '#896BFF']}
            style={styles.fab}
          >
            <Text style={styles.fabText}>+</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F3',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    flex: 1,
    marginTop: -20,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 120,
  },
  cardOuter: {
    marginBottom: 16,
  },
  cardShadow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#D1D9E6',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 6,
  },
  card: {
    backgroundColor: '#F0F0F3',
    borderRadius: 24,
    padding: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  cardHeader: {
    marginBottom: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3436',
    marginRight: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeActive: {
    backgroundColor: 'rgba(0, 184, 148, 0.1)',
  },
  badgeExpired: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  badgeCompleted: {
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6C63FF',
  },
  cardDescription: {
    fontSize: 13,
    color: '#636E72',
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoRow: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#B2BEC3',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3436',
  },
  qrPreview: {
    width: 60,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
  },
  qrImage: {
    width: '100%',
    height: '100%',
  },
  qrPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E8E8EB',
    borderRadius: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#636E72',
    textAlign: 'center',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: -2,
  },
});
