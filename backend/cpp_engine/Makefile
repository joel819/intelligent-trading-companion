CXX = g++
CXXFLAGS = -fPIC -shared -O3 -Wall

TARGET = libengine.so
SOURCES = engine.cpp

all: $(TARGET)

$(TARGET): $(SOURCES)
	$(CXX) $(CXXFLAGS) -o $(TARGET) $(SOURCES)

clean:
	rm -f $(TARGET)
