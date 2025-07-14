package org.extendify.arsc;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import pink.madis.apk.arsc.*;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Paths;

public class Main {
    public static void main(String[] args) throws IOException {
        if (args.length < 2) {
            return;
        }

        String resourcesPath = args[0];
        String outPath = args[1];
        JsonObject result = new JsonObject();

        InputStream stream = Files.newInputStream(Paths.get(resourcesPath));
        ResourceFile resources = ResourceFile.fromInputStream(stream);
        ResourceTableChunk table = (ResourceTableChunk) resources.getChunks().get(0);
        PackageChunk pkg = table.getPackages().iterator().next();

        for (TypeChunk typeChunk : pkg.getTypeChunks()) {
            String langString = typeChunk.getConfiguration().languageString();
            if (!typeChunk.getTypeName().equals("string") || !(langString.equals("en") || langString.isEmpty())) {
                continue;
            }

            for (TypeChunk.Entry entry : typeChunk.getEntries().values()) {
                ResourceValue value = entry.value();
                if (value == null || value.data() > table.getStringPool().getStringCount()) {
                    continue;
                }

                result.addProperty(entry.key(), table.getStringPool().getString(value.data()));
            }
        }

        stream.close();

        FileWriter writer = new FileWriter(outPath);
        writer.write(new Gson().toJson(result));
        writer.close();
    }
}