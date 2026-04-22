import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Linking,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  List,
  Divider,
  useTheme,
  Card,
  Button,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Navbar from '../../components/Navbar';
import api from '../../utils/api';

const HelpSupport = () => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(null);

  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [helplines, setHelplines] = useState([]);
  const [helplineLoading, setHelplineLoading] = useState(true);
  const [helplineError, setHelplineError] = useState(false);

  const toggleExpand = index => {
    setExpanded(prev => (prev === index ? null : index));
  };

  const fetchFaqs = async () => {
    try {
      setLoading(true);
      setError(false);
      const response = await api.get('/faq');
      console.log('FAQ response:', JSON.stringify(response?.data));
      const data = response?.data?.data || response?.data || [];
      setFaqs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log('FAQ API Error:', err?.response?.data || err.message);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchHelpLine = async () => {
    try {
      setHelplineLoading(true);
      setHelplineError(false);

      // ✅ Try both endpoints
      let response;
      try {
        response = await api.get('/helpline');
      } catch {
        response = await api.get('/all-helpline');
      }

      console.log('Helpline raw response:', JSON.stringify(response?.data));

      const raw = response?.data;

      // Handle all possible shapes:
      // { success, data: {...} }  → single object
      // { success, data: [...] }  → array
      // [...]                     → direct array
      // {...}                     → direct object

      let resolved = null;

      if (raw?.data) {
        resolved = raw.data;
      } else if (Array.isArray(raw)) {
        resolved = raw;
      } else if (raw && typeof raw === 'object') {
        resolved = raw;
      }

      if (!resolved) {
        setHelplines([]);
        return;
      }

      if (Array.isArray(resolved)) {
        const sorted = [...resolved].sort(
          (a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0),
        );
        setHelplines(sorted);
      } else if (typeof resolved === 'object') {
        // Single object — make sure it has phone or email before wrapping
        if (resolved.phone || resolved.email) {
          setHelplines([resolved]);
        } else {
          setHelplines([]);
        }
      } else {
        setHelplines([]);
      }
    } catch (err) {
      console.log('Helpline fetch error:', err?.response?.data || err?.message);
      setHelplineError(true);
      setHelplines([]);
    } finally {
      setHelplineLoading(false);
    }
  };

  useEffect(() => {
    fetchFaqs();
    fetchHelpLine();
  }, []);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Navbar title={'Help & Support'} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text
          variant="bodyMedium"
          style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
        >
          Find answers or reach out to us
        </Text>

        {/* ── FAQ Section ── */}
        <Card
          style={[
            styles.card,
            { backgroundColor: theme.colors.elevation.level1 },
          ]}
        >
          <Card.Title
            title="FAQs"
            titleStyle={{ color: theme.colors.onSurface }}
          />
          <Card.Content>
            {loading && (
              <ActivityIndicator
                size="small"
                color={theme.colors.primary}
                style={{ marginVertical: 12 }}
              />
            )}

            {!loading && error && (
              <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                <Text style={{ color: theme.colors.error, marginBottom: 8 }}>
                  Failed to load FAQs.
                </Text>
                <Button mode="outlined" onPress={fetchFaqs}>
                  Retry
                </Button>
              </View>
            )}

            {!loading && !error && faqs.length === 0 && (
              <Text
                style={{
                  color: theme.colors.onSurfaceVariant,
                  marginVertical: 8,
                }}
              >
                No FAQs available
              </Text>
            )}

            {!loading &&
              !error &&
              faqs.map((item, index) => (
                <View key={item._id || index}>
                  <List.Accordion
                    title={item.question || item.q || 'No Question'}
                    expanded={expanded === index}
                    onPress={() => toggleExpand(index)}
                    titleStyle={{ color: theme.colors.onSurface }}
                    titleNumberOfLines={3}
                    style={styles.accordion}
                  >
                    <View style={styles.answerContainer}>
                      <Text
                        style={{
                          color: theme.colors.onSurfaceVariant,
                          lineHeight: 22,
                        }}
                      >
                        {item.answer || item.a || 'No Answer'}
                      </Text>
                    </View>
                  </List.Accordion>
                  {index < faqs.length - 1 && <Divider />}
                </View>
              ))}
          </Card.Content>
        </Card>

        {/* ── Contact Section ── */}
        <Card
          style={[
            styles.card,
            { backgroundColor: theme.colors.elevation.level1 },
          ]}
        >
          <Card.Title
            title="Contact Us"
            titleStyle={{ color: theme.colors.onSurface }}
          />
          <Card.Content>
            {helplineLoading && (
              <ActivityIndicator
                size="small"
                color={theme.colors.primary}
                style={{ marginVertical: 12 }}
              />
            )}

            {!helplineLoading && helplineError && (
              <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                <Text style={{ color: theme.colors.error, marginBottom: 8 }}>
                  Failed to load contact info.
                </Text>
                <Button mode="outlined" onPress={fetchHelpLine}>
                  Retry
                </Button>
              </View>
            )}

            {!helplineLoading && !helplineError && helplines.length === 0 && (
              <Text
                style={{
                  color: theme.colors.onSurfaceVariant,
                  marginVertical: 8,
                }}
              >
                No contact information available
              </Text>
            )}

            {!helplineLoading &&
              !helplineError &&
              helplines.map((item, index) => (
                <View key={item._id || index}>
                  {!!item.email && (
                    <>
                      <List.Item
                        title="Email Support"
                        description={item.email}
                        titleStyle={{ color: theme.colors.onSurface }}
                        descriptionStyle={{
                          color: theme.colors.onSurfaceVariant,
                        }}
                        left={props => (
                          <List.Icon
                            {...props}
                            icon="email"
                            color={theme.colors.primary}
                          />
                        )}
                        onPress={() => Linking.openURL(`mailto:${item.email}`)}
                      />
                      <Divider />
                    </>
                  )}

                  {!!item.phone && (
                    <>
                      <List.Item
                        title="WhatsApp"
                        description={`+91 ${item.phone}`}
                        titleStyle={{ color: theme.colors.onSurface }}
                        descriptionStyle={{
                          color: theme.colors.onSurfaceVariant,
                        }}
                        left={props => (
                          <List.Icon
                            {...props}
                            icon="whatsapp"
                            color="#25D366"
                          />
                        )}
                        onPress={() =>
                          Linking.openURL(`https://wa.me/91${item.phone}`)
                        }
                      />
                      <Divider />
                      <List.Item
                        title="Call Us"
                        description={`+91 ${item.phone}`}
                        titleStyle={{ color: theme.colors.onSurface }}
                        descriptionStyle={{
                          color: theme.colors.onSurfaceVariant,
                        }}
                        left={props => (
                          <List.Icon
                            {...props}
                            icon="phone"
                            color={theme.colors.primary}
                          />
                        )}
                        onPress={() => Linking.openURL(`tel:+91${item.phone}`)}
                      />
                      {index < helplines.length - 1 && <Divider />}
                    </>
                  )}
                </View>
              ))}
          </Card.Content>
        </Card>

        <Text
          variant="bodySmall"
          style={[styles.footer, { color: theme.colors.onSurfaceVariant }]}
        >
          We usually reply within 24 hours
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  subtitle: { marginBottom: 16, opacity: 0.7 },
  card: { marginBottom: 20, borderRadius: 12 },
  accordion: { backgroundColor: 'transparent' },
  answerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  footer: { textAlign: 'center', marginTop: 12, opacity: 0.7 },
});

export default HelpSupport;
